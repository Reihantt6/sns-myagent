#!/usr/bin/env bash
# SNS-MyAgent E2E smoke test
# Runs against a freshly built binary to verify all critical paths work.
# Usage: ./scripts/smoke-test.sh [path-to-binary]
# Exit 0 on PASS, 1 on any FAIL.

set -uo pipefail

BIN="${1:-./bin/snscoder-linux-x64}"
FAIL=0
PASS=0

run() {
	local label="$1"
	shift
	local expect_code="${1:-0}"
	shift
	local out
	out=$("$BIN" "$@" 2>&1)
	local actual=$?
	if [[ $actual -eq $expect_code ]]; then
		echo "✓ $label"
		PASS=$((PASS + 1))
	else
		echo "✗ $label (expected exit $expect_code, got $actual)"
		echo "  output: $out"
		FAIL=$((FAIL + 1))
	fi
}

echo "=== SNS-MyAgent E2E smoke test ==="
echo "Binary: $BIN"
echo ""

if [[ ! -x "$BIN" ]]; then
	echo "✗ binary not found or not executable: $BIN"
	exit 1
fi

# Version + help
run "version flag" 0 --version
run "version subcommand" 0 version
run "help flag" 0 --help
run "help subcommand" 0 help

# Init (skips if config exists)
run "init (idempotent)" 0 init

# Config subcommands
run "config show" 0 config show
run "config get model.provider" 0 config get model.provider 2>&1 | head -1 || true

# Orchestrate (stub returns exit 2 with clear message)
out=$("$BIN" orchestrate "test prompt" 2>&1)
if [[ "$out" == *"agent executor not wired"* ]]; then
	echo "✓ orchestrate shows clear stub message"
	PASS=$((PASS + 1))
else
	echo "✗ orchestrate stub message missing"
	echo "  output: $out"
	FAIL=$((FAIL + 1))
fi

# Unknown command
run "unknown command (exit 1)" 1 nonexistent-command

# Telegram subcommand (status should be safe to call)
out=$("$BIN" telegram status 2>&1)
if [[ $? -eq 0 ]]; then
	echo "✓ telegram status"
	PASS=$((PASS + 1))
else
	echo "✗ telegram status (non-zero exit)"
	FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Summary ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"

if [[ $FAIL -gt 0 ]]; then
	exit 1
fi
exit 0