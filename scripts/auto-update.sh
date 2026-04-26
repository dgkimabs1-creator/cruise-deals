#!/bin/bash
set -euo pipefail
# 크루즈 데이터 자동 갱신 + GitHub push
# zmfnwm 크론 후에 실행
# 2026-04-25 codex P1 audit fixes: stale lock detection + trap 자식 종료 대기 +
# git push timeout + git push fail 시 재시도 + 2>/dev/null 제거.

LOCK_FILE="/tmp/cruise-auto-update.lock"
# 2026-04-26 P1 fix audit (cruise): atomic lock — set -C (noclobber) 로 race-free.
# 이전엔 -f 검사 후 write 분리 → 두 프로세스 동시 시작 시 둘 다 통과 가능.
_acquire_lock() {
  # noclobber 로 atomic create-or-fail
  if (set -C; echo "$$" > "$LOCK_FILE") 2>/dev/null; then
    return 0
  fi
  # 이미 존재 — stale 검사
  local existing_pid
  existing_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Already running (pid=$existing_pid), skip"
    exit 0
  fi
  # stale — atomic 으로 교체 (rm + noclobber write)
  echo "Stale lock (pid=$existing_pid not running) — replacing"
  rm -f "$LOCK_FILE"
  if ! (set -C; echo "$$" > "$LOCK_FILE") 2>/dev/null; then
    echo "Lock race — 다른 프로세스가 먼저 획득함, skip"
    exit 0
  fi
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
# 2026-04-26 P1 fix audit (cruise): timeout 명령 macOS 기본 미설치 → gtimeout (coreutils) 또는 fallback.
# 이전 `timeout 60 git push` 가 timeout 명령 부재로 즉시 실패하던 문제.
# 2026-04-26 P1 follow-up (codex audit): fallback 보강
#  - killer-fired flag 로 timeout 시 124 반환 (coreutils 호환)
#  - process group kill (kill -- -PGID) 로 git 자식 (curl/ssh) 까지 정리
_run_with_timeout() {
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$secs" "$@"
  else
    # fallback: setsid 로 새 process group 시작 → 자식 프로세스 까지 한번에 종료 가능
    local _flag="/tmp/cruise_timeout_killed.$$"
    rm -f "$_flag"
    # setsid 가 있으면 새 PG 로 실행, 없으면 그냥 background
    if command -v setsid >/dev/null 2>&1; then
      setsid "$@" &
    else
      "$@" &
    fi
    local _pid=$!
    (
      sleep "$secs"
      if kill -0 "$_pid" 2>/dev/null; then
        : > "$_flag"
        # process group kill (음수 PID = PGID) — 자식 까지 정리
        kill -TERM -- "-$_pid" 2>/dev/null || kill -TERM "$_pid" 2>/dev/null
        sleep 5
        kill -KILL -- "-$_pid" 2>/dev/null || kill -KILL "$_pid" 2>/dev/null
      fi
    ) &
    local _killer=$!
    wait "$_pid" 2>/dev/null
    local _rc=$?
    kill -TERM "$_killer" 2>/dev/null || true
    wait "$_killer" 2>/dev/null || true
    if [[ -e "$_flag" ]]; then
      rm -f "$_flag"
      return 124  # coreutils timeout convention
    fi
    return $_rc
  fi
}

# 2026-04-26 P1 fix audit (cruise): git push 재시도 추가 (주석엔 있었지만 실제 코드엔 없었음).
# 60s timeout × 2회 시도. 실패해도 ahead 상태로 남으니 다음 run 에서 재시도 가능.
_push_attempt=0
_push_max_attempts=2
_push_ok=0
while [[ $_push_attempt -lt $_push_max_attempts ]]; do
  _push_attempt=$((_push_attempt + 1))
  if _run_with_timeout 60 git push origin main; then
    _push_ok=1
    break
  fi
  echo "WARN: git push attempt $_push_attempt/$_push_max_attempts 실패"
  if [[ $_push_attempt -lt $_push_max_attempts ]]; then
    sleep 5
  fi
done
if [[ $_push_ok -eq 0 ]]; then
  echo "ERROR: git push 2회 실패 — 다음 run 에서 재시도 (HEAD 가 ahead 상태로 남음)"
  exit 1
fi
echo "Pushed updated data"
