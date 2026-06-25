#!/usr/bin/env bash
set -euo pipefail

# SNS MyAgent Installer — Multi-arch, Termux-aware
# Usage: curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
#
# Supports: Linux x64, Linux ARM64 (Termux/Android), macOS x64/arm64, Windows (WSL)
# Strategy: download prebuilt binary (fast) → fallback to build-from-source (bun needed)

REPO="Reihantt6/sns-myagent"
RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"
INSTALL_DIR="${SNS_INSTALL_DIR:-$HOME/.local/bin}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "${CYAN}[→]${NC} $1"; }

# ── Detect platform + arch ──────────────────────────────────────────────
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Linux*)  PLATFORM="linux" ;;
    Darwin*) PLATFORM="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
    *) error "Unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH_NORM="x64" ;;
    aarch64|arm64) ARCH_NORM="arm64" ;;
    armv7l|armhf)  ARCH_NORM="armv7l" ;;
    *) error "Unsupported architecture: $ARCH" ;;
  esac

  # Detect Termux (Android)
  IS_TERMUX=false
  if [ -n "${TERMUX_VERSION:-}" ] || [ -d "/data/data/com.termux" ] || [ "$(uname -o 2>/dev/null)" = "Android" ]; then
    IS_TERMUX=true
  fi

  # Detect musl (Alpine)
  IS_MUSL=false
  if command -v ldd &>/dev/null && ldd /bin/sh 2>/dev/null | grep -q musl; then
    IS_MUSL=true
  fi

  info "Platform: ${PLATFORM}/${ARCH_NORM}$([ "$IS_TERMUX" = true ] && echo " (Termux)")$([ "$IS_MUSL" = true ] && echo " (musl)")"
}

# ── Map to GitHub release asset name ────────────────────────────────────
asset_name() {
  local os="$1" arch="$2" musl="$3"
  case "$os" in
    linux)
      if [ "$musl" = true ]; then
        case "$arch" in
          x64)    echo "snscoder-linux-x64-musl" ;;
          arm64)  echo "snscoder-linux-arm64-musl" ;;
        esac
      else
        case "$arch" in
          x64)    echo "snscoder-linux-x64" ;;
          arm64)  echo "snscoder-linux-arm64" ;;
          armv7l) echo "snscoder-linux-armv7l" ;;
        esac
      fi
      ;;
    darwin)
      case "$arch" in
        x64)   echo "snscoder-darwin-x64" ;;
        arm64) echo "snscoder-darwin-arm64" ;;
      esac
      ;;
    windows)
      echo "snscoder-windows-x64.exe"
      ;;
  esac
}

# ── Download prebuilt binary from GitHub ────────────────────────────────
download_binary() {
  local asset
  asset="$(asset_name "$PLATFORM" "$ARCH_NORM" "$IS_MUSL")"

  if [ -z "$asset" ]; then
    warn "No prebuilt binary for ${PLATFORM}/${ARCH_NORM}"
    return 1
  fi

  step "Downloading ${asset} from latest release..."

  # Fetch release info
  local auth_header=""
  [ -n "$GITHUB_TOKEN" ] && auth_header="Authorization: token ${GITHUB_TOKEN}"

  local release_info
  if [ -n "$auth_header" ]; then
    release_info=$(curl -fsSL -H "$auth_header" "$RELEASE_URL" 2>/dev/null) || return 1
  else
    release_info=$(curl -fsSL "$RELEASE_URL" 2>/dev/null) || return 1
  fi

  # Extract download URL for the asset
  local download_url
  download_url=$(echo "$release_info" | grep -o "\"browser_download_url\": *\"[^\"]*${asset}[^\"]*\"" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')

  if [ -z "$download_url" ]; then
    warn "Asset ${asset} not found in latest release"
    return 1
  fi

  # Download to temp file
  local tmpfile
  tmpfile=$(mktemp /tmp/snscoder.XXXXXX)

  if [ -n "$auth_header" ]; then
    curl -fsSL -H "$auth_header" -o "$tmpfile" "$download_url" || { rm -f "$tmpfile"; return 1; }
  else
    curl -fsSL -o "$tmpfile" "$download_url" || { rm -f "$tmpfile"; return 1; }
  fi

  # Check if it's a zip file
  if file "$tmpfile" | grep -qiE "zip|compress"; then
    local tmpdir
    tmpdir=$(mktemp -d /tmp/snscoder-extract.XXXXXX)
    unzip -oq "$tmpfile" -d "$tmpdir" 2>/dev/null || { rm -rf "$tmpfile" "$tmpdir"; return 1; }
    # Find the binary inside
    local binary
    binary=$(find "$tmpdir" -name "snscoder*" -type f -executable 2>/dev/null | head -1)
    [ -z "$binary" ] && binary=$(find "$tmpdir" -name "snscoder*" -type f 2>/dev/null | head -1)
    if [ -z "$binary" ]; then
      rm -rf "$tmpfile" "$tmpdir"
      return 1
    fi
    mv "$binary" "$tmpfile"
    rm -rf "$tmpdir"
  fi

  # Install
  mkdir -p "$INSTALL_DIR"
  local dest="${INSTALL_DIR}/snscoder"
  mv "$tmpfile" "$dest"
  chmod 755 "$dest"

  # Verify
  if "$dest" --version &>/dev/null; then
    info "snscoder installed to ${dest}"
    return 0
  else
    warn "Binary downloaded but --version check failed (may need first-run setup)"
    info "Installed to ${dest}"
    return 0
  fi
}

# ── Build from source (fallback) ───────────────────────────────────────
build_from_source() {
  step "Building from source (requires bun ≥ 1.3.14)..."

  # Check/install bun
  if ! command -v bun &>/dev/null; then
    warn "Bun not found. Installing..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    [ -s "$BUN_INSTALL/bin/bun" ] && export PATH="$BUN_INSTALL/bin:$PATH"
    command -v bun &>/dev/null || error "Bun installation failed. Install manually: https://bun.sh"
    info "Bun $(bun --version) installed"
  fi

  local build_dir
  build_dir=$(mktemp -d /tmp/snscoder-build.XXXXXX)
  step "Cloning repo to ${build_dir}..."
  git clone --depth 1 "https://github.com/${REPO}.git" "$build_dir" 2>/dev/null || error "git clone failed"
  cd "$build_dir"

  step "Installing dependencies..."
  bun install --frozen-lockfile 2>/dev/null || bun install

  step "Building binary..."
  bun run build

  mkdir -p "$INSTALL_DIR"
  cp bin/snscoder "${INSTALL_DIR}/snscoder"
  chmod 755 "${INSTALL_DIR}/snscoder"
  cd /
  rm -rf "$build_dir"

  info "snscoder built and installed to ${INSTALL_DIR}/snscoder"
}

# ── Ensure PATH includes install dir ────────────────────────────────────
ensure_path() {
  local shell_rc=""
  case "$SHELL" in
    */bash) shell_rc="$HOME/.bashrc" ;;
    */zsh)  shell_rc="$HOME/.zshrc" ;;
    */fish) shell_rc="$HOME/.config/fish/config.fish" ;;
  esac

  if [ -n "$shell_rc" ] && [ -f "$shell_rc" ]; then
    if ! grep -qF "$INSTALL_DIR" "$shell_rc" 2>/dev/null; then
      step "Adding ${INSTALL_DIR} to PATH in ${shell_rc}..."
      if [[ "$shell_rc" == *fish ]]; then
        echo "set -gx PATH \$PATH ${INSTALL_DIR}" >> "$shell_rc"
      else
        echo "export PATH=\"\${PATH}:${INSTALL_DIR}\"" >> "$shell_rc"
      fi
      info "PATH updated. Run: source ${shell_rc}"
    fi
  fi
}

# ── Termux-specific setup ───────────────────────────────────────────────
termux_setup() {
  if [ "$IS_TERMUX" = true ]; then
    step "Termux detected — ensuring dependencies..."
    # Core utils needed
    pkg install -y git curl unzip 2>/dev/null || true

    # Termux has its own PATH conventions
    INSTALL_DIR="${SNS_INSTALL_DIR:-$HOME/.local/bin}"
    mkdir -p "$INSTALL_DIR"

    info "Termux setup complete"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║     SNS MyAgent Installer v0.1.0    ║${NC}"
  echo -e "${BOLD}║     snscoder — BYOK coding agent    ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
  echo ""

  detect_platform
  termux_setup

  # Strategy: prebuilt binary first, build-from-source fallback
  if download_binary; then
    ensure_path
    echo ""
    info "Installation complete!"
    info "Run: snscoder --help"
    [ "$IS_TERMUX" = true ] && info "Or add to PATH: export PATH=\"\$PATH:${INSTALL_DIR}\""
    echo ""
    return 0
  fi

  warn "Prebuilt binary not available. Building from source..."
  build_from_source
  ensure_path
  echo ""
  info "Installation complete!"
  info "Run: snscoder --help"
  echo ""
}

main "$@"
