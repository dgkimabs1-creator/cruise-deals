#!/bin/bash
# 크루즈 데이터 자동 갱신 + GitHub push
# zmfnwm 크론 후에 실행

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
git commit -m "data: auto-update $(date '+%Y-%m-%d %H:%M KST')"
git push origin main
echo "Pushed updated data"
