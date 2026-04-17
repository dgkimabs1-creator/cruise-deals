#!/bin/bash
set -euo pipefail
# 크루즈 데이터 자동 갱신 + GitHub push
# zmfnwm 크론 후에 실행

# 중복 실행 방지 — 같은 스크립트가 두 번 도는 동안 export/git 시퀀스가 race 발생
LOCK_DIR="/tmp/cruise-auto-update.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Already running (lock=$LOCK_DIR), skip"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR" || exit 1

# 1. Export public data
node "$SCRIPT_DIR/export-public-data.js"

# 2. Git add + commit + push (변경 있을 때만)
if git diff --quiet data/cruises-public.json 2>/dev/null; then
  echo "No data changes, skip push"
  exit 0
fi

git add data/cruises-public.json
# TZ 명시 — non-KST 호스트에서 실행돼도 라벨이 일관되게.
git commit -m "data: auto-update $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"
git push origin main
echo "Pushed updated data"
