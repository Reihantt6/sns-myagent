#!/usr/bin/env bash
# scripts/diagnose.sh — self-diagnosing health check for sns-myagent
# Exits 0 on PASS, 1 on FAIL. Safe to run from anywhere; cd's to repo root.

set -e

# Resolve repo root (script lives in scripts/, so parent of parent)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Colors only when TTY (avoid ANSI in cron logs)
if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; BOLD=""; RESET=""
fi

FAIL=0
WARN=0
PASS_COUNT=0

ok()   { echo "${GREEN}[PASS]${RESET} $*"; PASS_COUNT=$((PASS_COUNT+1)); }
warn() { echo "${YELLOW}[WARN]${RESET} $*"; WARN=$((WARN+1)); }
bad()  { echo "${RED}[FAIL]${RESET} $*"; FAIL=$((FAIL+1)); }
hdr()  { echo; echo "${BOLD}== $* ==${RESET}"; }

hdr "1. Runtime checks"

# Bun version
if command -v bun >/dev/null 2>&1; then
  BUN_VER="$(bun --version 2>/dev/null || echo unknown)"
  if printf '%s\n1.3.14\n' "$BUN_VER" | sort -V -C 2>/dev/null; then
    ok "Bun $BUN_VER (>=1.3.14)"
  else
    bad "Bun $BUN_VER too old (need >=1.3.14)"
  fi
else
  bad "Bun not installed"
fi

# Node (for fallback)
if command -v node >/dev/null 2>&1; then
  ok "Node $(node --version)"
else
  warn "Node not installed (needed for fallback)"
fi

# git available
if command -v git >/dev/null 2>&1; then
  ok "git available"
else
  bad "git missing"
fi

hdr "2. Repository state"

if [ -d .git ]; then
  ok "git repo initialized"
else
  bad "not a git repo"
fi

# Clean working tree?
if git status --porcelain 2>/dev/null | grep -q .; then
  UNCOMMITTED="$(git status --short 2>/dev/null | wc -l | tr -d ' ')"
  warn "$UNCOMMITTED uncommitted change(s):"
  git status --short | sed 's/^/    /'
else
  ok "working tree clean"
fi

# Current branch + last commit
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
LAST="$(git log -1 --oneline 2>/dev/null || echo 'none')"
echo "    branch: $BRANCH"
echo "    last:   $LAST"

hdr "3. TypeScript type check"

if [ ! -f tsconfig.json ]; then
  bad "tsconfig.json missing"
else
  ok "tsconfig.json present"
fi

# Prefer tsgo (project uses it), fall back to tsc
TSC_CMD=""
if [ -x node_modules/.bin/tsgo ]; then
  TSC_CMD="node_modules/.bin/tsgo -p tsconfig.json --noEmit"
elif command -v tsgo >/dev/null 2>&1; then
  TSC_CMD="tsgo -p tsconfig.json --noEmit"
elif [ -x node_modules/.bin/tsc ]; then
  TSC_CMD="node_modules/.bin/tsc -p tsconfig.json --noEmit"
elif command -v npx >/dev/null 2>&1; then
  TSC_CMD="npx --yes tsc -p tsconfig.json --noEmit"
fi

if [ -z "$TSC_CMD" ]; then
  bad "no TypeScript compiler found"
else
  echo "    running: $TSC_CMD"
  TSC_OUT="$(eval "$TSC_CMD" 2>&1 || true)"
  TSC_EXIT=$?
  if [ -z "$TSC_OUT" ]; then
    ok "TSC clean (no errors)"
  else
    TOTAL_LINES="$(printf '%s\n' "$TSC_OUT" | wc -l | tr -d ' ')"
    bad "TSC found errors ($TOTAL_LINES lines)"
    echo
    echo "${BOLD}Top error files:${RESET}"
    printf '%s\n' "$TSC_OUT" \
      | grep -E '\.ts\([0-9]+,[0-9]+\):' \
      | sed -E 's/^([^[:space:]]+\.ts)\([0-9]+,[0-9]+\):.*/\1/' \
      | sort | uniq -c | sort -rn | head -10 \
      | sed 's/^/    /'
    echo
    echo "${BOLD}First 15 error lines:${RESET}"
    printf '%s\n' "$TSC_OUT" | head -15 | sed 's/^/    /'
  fi
fi

hdr "4. Build output"

if [ -d dist ]; then
  DIST_FILES="$(find dist -type f 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$DIST_FILES" -gt 0 ]; then
    ok "dist/ present ($DIST_FILES files)"
  else
    bad "dist/ empty (no successful build)"
  fi
else
  bad "dist/ missing (never built)"
fi

hdr "5. Postinstall hang risk"

# Detect postinstall hooks that fetch binaries (known hang risk)
if grep -q '"postinstall"' package.json 2>/dev/null; then
  POST_SCRIPT="$(node -e "try { console.log(require('./package.json').scripts.postinstall||'') } catch(e){}" 2>/dev/null || true)"
  if [ -n "$POST_SCRIPT" ]; then
    # Risk if it tries to download from network without timeout
    if printf '%s' "$POST_SCRIPT" | grep -qE 'fetch-binary|curl |wget |https?://'; then
      warn "postinstall does network I/O: $POST_SCRIPT"
      warn "    risk: hangs >5min on slow networks. Consider: SKIP_POSTINSTALL=1"
    else
      ok "postinstall: $POST_SCRIPT (low risk)"
    fi
  fi
else
  ok "no postinstall hook"
fi

# node_modules sanity
if [ -d node_modules ]; then
  NM_COUNT="$(find node_modules -maxdepth 2 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$NM_COUNT" -lt 10 ]; then
    bad "node_modules sparse ($NM_COUNT entries) — install failed?"
  else
    ok "node_modules populated ($NM_COUNT top-level entries)"
  fi
else
  bad "node_modules missing"
fi

hdr "Summary"
echo "  ${GREEN}PASS${RESET}: $PASS_COUNT"
echo "  ${YELLOW}WARN${RESET}: $WARN"
echo "  ${RED}FAIL${RESET}: $FAIL"
echo

if [ "$FAIL" -gt 0 ]; then
  echo "${RED}${BOLD}DIAGNOSE: FAIL${RESET}"
  exit 1
fi

if [ "$WARN" -gt 0 ]; then
  echo "${YELLOW}${BOLD}DIAGNOSE: PASS (with warnings)${RESET}"
  exit 0
fi

echo "${GREEN}${BOLD}DIAGNOSE: PASS${RESET}"
exit 0