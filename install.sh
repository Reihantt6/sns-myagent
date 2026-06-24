#!/usr/bin/env bash
set -euo pipefail

# SNS MyAgent Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[info]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

# Check Bun (>= 1.3.14 required per package.json engines.bun)
check_bun() {
  if command -v bun &>/dev/null; then
    BUN_VER=$(bun --version | cut -d. -f1,2)
    BUN_MAJOR=$(echo "$BUN_VER" | cut -d. -f1)
    BUN_MINOR=$(echo "$BUN_VER" | cut -d. -f2)
    if [ "$BUN_MAJOR" -lt 1 ] || { [ "$BUN_MAJOR" -eq 1 ] && [ "$BUN_MINOR" -lt 3 ]; }; then
      warn "Bun $BUN_VER found but >= 1.3.14 required. Installing latest..."
      install_bun=true
    else
      info "Bun $(bun --version) found ✓"
      install_bun=false
    fi
  else
    warn "Bun not found. Installing..."
    install_bun=true
  fi

  if [ "$install_bun" = true ]; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    [ -s "$BUN_INSTALL/bin/bun" ] && export PATH="$BUN_INSTALL/bin:$PATH"
    if ! command -v bun &>/dev/null; then
      error "Bun installation failed. Install manually: https://bun.sh"
    fi
    info "Bun $(bun --version) installed ✓"
  fi
}

# Install SNS MyAgent
install_snscoder() {
  if command -v bun &>/dev/null; then
    info "Installing snscoder globally via bun..."
    bun add -g snscoder
    info "snscoder installed ✓"
  else
    error "bun not found. Install Bun first: https://bun.sh"
  fi
}

# Setup
setup() {
  info "Running initial setup..."
  if command -v snscoder &>/dev/null; then
    snscoder --setup 2>/dev/null || true
    info "Setup complete ✓"
  else
    warn "snscoder command not found in PATH. Try: source ~/.bashrc && snscoder"
  fi
}

main() {
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║     SNS MyAgent Installer            ║"
  echo "╚══════════════════════════════════════╝"
  echo ""
  check_bun
  install_snscoder
  setup
  echo ""
  info "Run 'snscoder' to start."
  info "Or: bun run build && snscoder (from cloned repo)"
  echo ""
}

main "$@"