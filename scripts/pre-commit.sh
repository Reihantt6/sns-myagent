#!/usr/bin/env bash
# scripts/pre-commit.sh — block commits if lint/typecheck/test fail
# Set SNS_SKIP_HOOKS=1 to bypass (emergency only).
set -e

# Resolve repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Colors only when TTY
if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; BOLD=""; RESET=""
fi

if [ "${SNS_SKIP_HOOKS:-0}" = "1" ]; then
  echo "${YELLOW}[pre-commit] SNS_SKIP_HOOKS=1 — bypassing checks${RESET}"
  exit 0
fi

echo "${BOLD}[pre-commit] running checks...${RESET}"

FAILED=0

run_step() {
  local label="$1"; shift
  echo
  echo "${BOLD}→ $label${RESET}"
  # Run command, pipe through tail for readable output, capture real exit via PIPESTATUS
  set +e
  "$@" 2>&1 | tail -40
  local rc=${PIPESTATUS[0]}
  set -e
  if [ "$rc" -eq 0 ]; then
    echo "${GREEN}[pre-commit] $label OK${RESET}"
  else
    echo "${RED}[pre-commit] $label FAILED (exit $rc)${RESET}"
    FAILED=1
  fi
}

# 1. Lint (graceful: missing biome = warn, don't block)
if command -v bun >/dev/null 2>&1; then
  if [ -x node_modules/.bin/biome ] || command -v biome >/dev/null 2>&1; then
    run_step "lint" bun run lint || FAILED=1
  else
    echo "${YELLOW}[pre-commit] biome not installed — skipping lint${RESET}"
  fi
else
  echo "${YELLOW}[pre-commit] bun not installed — skipping lint${RESET}"
fi

# 2. Type check (critical: blocks on TS errors)
if [ -x node_modules/.bin/tsgo ]; then
  run_step "typecheck" node_modules/.bin/tsgo -p tsconfig.json --noEmit || FAILED=1
elif [ -x node_modules/.bin/tsc ]; then
  run_step "typecheck" node_modules/.bin/tsc -p tsconfig.json --noEmit || FAILED=1
elif command -v npx >/dev/null 2>&1; then
  run_step "typecheck" npx --yes tsc -p tsconfig.json --noEmit || FAILED=1
else
  echo "${RED}[pre-commit] no TypeScript compiler found${RESET}"
  FAILED=1
fi

# 3. Test (graceful: no tests = skip)
if [ -d test ] || [ -d tests ]; then
  if command -v bun >/dev/null 2>&1; then
    run_step "test" bun test || FAILED=1
  else
    echo "${YELLOW}[pre-commit] bun not installed — skipping tests${RESET}"
  fi
else
  echo "${YELLOW}[pre-commit] no test directory — skipping tests${RESET}"
fi

echo
if [ "$FAILED" -ne 0 ]; then
  echo "${RED}${BOLD}[pre-commit] BLOCKED — fix errors above or set SNS_SKIP_HOOKS=1${RESET}"
  exit 1
fi

echo "${GREEN}${BOLD}[pre-commit] all checks passed${RESET}"
exit 0