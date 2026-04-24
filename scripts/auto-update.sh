#!/bin/bash
set -euo pipefail
# 크루즈 데이터 자동 갱신 + GitHub push
# zmfnwm 크론 후에 실행
# 2026-04-25 codex P1 audit fixes: stale lock detection + trap 자식 종료 대기 +
# git push timeout + git push fail 시 재시도 + 2>/dev/null 제거.

LOCK_FILE="/tmp/cruise-auto-update.lock"
# PID + 타임스탬프 기반 lock — mkdir 은 crash 시 stale lock 남으면 영구 block.
# 대신 lockfile 에 pid 적고, 기존 pid 가 죽은 프로세스면 stale 로 간주하고 재획득.
_acquire_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local existing_pid
    existing_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      echo "Already running (pid=$existing_pid), skip"
      exit 0
    fi
    # stale lock
    echo "Stale lock (pid=$existing_pid not running) — removing"
    rm -f "$LOCK_FILE"
  fi
  echo "$$" > "$LOCK_FILE"
}

_cleanup() {
  # 자식 프로세스 종료 대기 — node/git 가 trap 시에 orphaned 되지 않게.
  local pids
  pids=$(jobs -p 2>/dev/null || echo "")
  if [[ -n "$pids" ]]; then
    echo "Terminating children: $pids"
    kill -TERM $pids 2>/dev/null || true
    wait 2>/dev/null || true
  fi
  if [[ -f "$LOCK_FILE" ]] && [[ "$(cat "$LOCK_FILE" 2>/dev/null || echo)" == "$$" ]]; then
    rm -f "$LOCK_FILE"
  fi
}

_acquire_lock
trap _cleanup EXIT INT TERM

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR" || exit 1

# 1. Export public data
node "$SCRIPT_DIR/export-public-data.js"

# 2. Git add + commit + push (변경 있을 때만)
# HEAD 대비 변경 있는지 확인 — 단순 working tree diff 는 staged 변경을 놓침.
# 또한 stderr 숨기지 않음 (이전엔 2>/dev/null 로 git 에러까지 삼켰음).
_has_pending_changes() {
  # 1) working tree 변경
  if ! git diff --quiet data/cruises-public.json; then
    return 0
  fi
  # 2) staged 변경 (이전 run 이 add 후 commit 전 실패한 경우)
  if ! git diff --cached --quiet data/cruises-public.json; then
    return 0
  fi
  # 3) 원격보다 ahead — 이전 commit 은 했지만 push 실패한 경우
  local ahead
  ahead=$(git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo "0")
  if [[ "$ahead" -gt 0 ]]; then
    return 0
  fi
  return 1
}

if ! _has_pending_changes; then
  echo "No data changes, skip push"
  exit 0
fi

# staged 아니면 add
if git diff --quiet --cached data/cruises-public.json; then
  if ! git diff --quiet data/cruises-public.json; then
    git add data/cruises-public.json
    # TZ 명시 — non-KST 호스트에서 실행돼도 라벨이 일관되게.
    git commit -m "data: auto-update $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"
  fi
fi

# Push with timeout — 네트워크 hung 으로 무한 block 방지 (이 후 모든 run 이 lock 대기).
if ! timeout 60 git push origin main; then
  echo "ERROR: git push 실패 — 다음 run 에서 재시도 (HEAD 가 ahead 상태로 남음)"
  exit 1
fi
echo "Pushed updated data"
