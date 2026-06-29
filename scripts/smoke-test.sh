#!/usr/bin/env bash
# SNS-MyAgent E2E smoke test
# Runs against a freshly built binary to verify all critical paths work.
# Usage: ./scripts/smoke-test.sh [path-to-binary]
# Exit 0 on PASS, 1 on any FAIL.
#
# NOTE: Binary may exit 1 in JS-only fallback mode (pi_natives missing on CI
# runner). We check stdout content rather than strict exit code for those.

set -uo pipefail

BIN="${1:-./bin/snscoder-linux-x64}"
FAIL=0
PASS=0

# run_check <label> <expect-exit> <cmd...>
# - exit code MUST match expect-exit for PASS
run_check() {
	local label="$1"
	local expect_code="$2"
	shift 2
	local out
	out=$("$BIN" "$@" 2>&1)
	local actual=$?
	if [[ $actual -eq $expect_code ]]; then
		echo "✓ $label"
		PASS=$((PASS + 1))
	else
		echo "✗ $label (expected exit $expect_code, got $actual)"
		echo "  output: ${out:0:200}"
		FAIL=$((FAIL + 1))
	fi
}

# run_loose <label> <expect-substring-in-stdout> <cmd...>
# - tolerates exit 0 OR 1 (JS-only fallback)
# - just checks stdout/stderr contains the substring
run_loose() {
	local label="$1"
	local needle="$2"
	shift 2
	local out
	out=$("$BIN" "$@" 2>&1)
	if [[ "$out" == *"$needle"* ]]; then
		echo "✓ $label"
		PASS=$((PASS + 1))
	else
		echo "✗ $label (missing '$needle' in output)"
		echo "  output: ${out:0:200}"
		FAIL=$((FAIL + 1))
	fi
}

echo "=== SNS-MyAgent E2E smoke test ==="
echo "Binary: $BIN"
echo ""

if [[ ! -f "$BIN" ]]; then
	echo "✗ binary not found: $BIN"
	exit 1
fi

# Version: pi_natives may be missing on CI runner → JS-only fallback may exit 1
# but version text still prints. Check substring rather than exit code.
run_loose "version flag prints version" "snscoder " --version
run_loose "version subcommand prints version" "snscoder " version

# Help: help uses only built-in code, should exit 0 reliably
run_check "help flag" 0 --help
run_check "help subcommand" 0 help

# Init (skips if config exists)
run_check "init (idempotent)" 0 init

# Config subcommands — may also be affected by js-only
run_loose "config show" "model" config show

# Orchestrate (stub returns exit 2 with clear message)
run_loose "orchestrate shows clear stub message" "agent executor not wired" orchestrate "test prompt"

# Unknown command — exit 1 guaranteed
run_check "unknown command (exit 1)" 1 nonexistent-command

echo ""
echo "=== Summary ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"

if [[ $FAIL -gt 0 ]]; then
	exit 1
fi
exit 0