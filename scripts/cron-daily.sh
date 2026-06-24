#!/usr/bin/env bash
# scripts/cron-daily.sh — short status report for external cron (under 500 chars).
# Designed to be called by cron/systemd-timer; produces one-line output.
# Bypass postinstall hangs: respects SKIP_POSTINSTALL=1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Plain output (no TTY colors in cron)
FAIL=0
NOTES=""

# git status
if git status --porcelain 2>/dev/null | grep -q .; then
  N=$(git status --porcelain | wc -l | tr -d ' ')
  NOTES="${NOTES}git:+${N} "
else
  NOTES="${NOTES}git:clean "
fi

# Branch + last commit
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
LAST="$(git log -1 --oneline 2>/dev/null | cut -c1-12 || echo 'none')"
NOTES="${NOTES}@${BRANCH}/${LAST} "

# dist/
if [ -d dist ] && [ "$(find dist -type f 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
  NOTES="${NOTES}dist:ok "
else
  NOTES="${NOTES}dist:MISSING "
  FAIL=1
fi

# TSC check (quick)
TSC_OK=0
if [ -x node_modules/.bin/tsgo ]; then
  node_modules/.bin/tsgo -p tsconfig.json --noEmit >/dev/null 2>&1 && TSC_OK=1 || true
elif [ -x node_modules/.bin/tsc ]; then
  node_modules/.bin/tsc -p tsconfig.json --noEmit >/dev/null 2>&1 && TSC_OK=1 || true
fi

if [ "$TSC_OK" = "1" ]; then
  NOTES="${NOTES}tsc:ok "
else
  NOTES="${NOTES}tsc:FAIL "
  FAIL=1
fi

# bun install hang risk (postinstall)
if grep -q '"postinstall"' package.json 2>/dev/null; then
  POST=$(node -e "try{console.log(require('./package.json').scripts.postinstall||'')}catch(e){}" 2>/dev/null || true)
  if printf '%s' "$POST" | grep -qE 'fetch-binary|curl|wget'; then
    NOTES="${NOTES}postinstall:NET "
  fi
fi

# Final report (single line, under 500 chars)
STATUS="OK"
[ "$FAIL" -gt 0 ] && STATUS="FAIL"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Truncate to 500 chars just in case
LINE="sns-myagent ${STATUS} ${TS} | ${NOTES}"
echo "${LINE:0:500}"

exit "$FAIL"