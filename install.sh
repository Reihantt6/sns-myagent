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

# Check Node.js
check_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -lt 20 ]; then
      warn "Node.js $NODE_VER found but >= 20 required. Installing via nvm..."
      install_node=true
    else
      info "Node.js $(node -v) found ✓"
      install_node=false
    fi
  else
    warn "Node.js not found. Installing via nvm..."
    install_node=true
  fi

  if [ "$install_node" = true ]; then
    if ! command -v nvm &>/dev/null; then
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    fi
    nvm install 22
    nvm use 22
    info "Node.js $(node -v) installed ✓"
  fi
}

# Install SNS MyAgent
install_snscoder() {
  if command -v npm &>/dev/null; then
    info "Installing snscoder globally via npm..."
    npm install -g snscoder
    info "snscoder installed ✓"
  else
    error "npm not found. Install Node.js first: https://nodejs.org"
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
  check_node
  install_snscoder
  setup
  echo ""
  info "Run 'snscoder' to start."
  info "Or: npm start (from cloned repo)"
  echo ""
}

main "$@"
