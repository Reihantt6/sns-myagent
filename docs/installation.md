# Installation Guide

snsagent v0.3.10 ships as an npm package (`@sns-myagent/cli`) with a prebuilt binary per
platform, plus a one-liner installer and a from-source path. This guide covers every method.

## Platform requirements

| Platform | Prebuilt binary | npm install | From source | Notes |
|---|---|---|---|---|
| Linux x64 (glibc) | ✅ `snsagent-linux-x64` | ✅ | ✅ | Most common target |
| Linux arm64 (glibc) | ✅ `snsagent-linux-arm64` | ✅ | ✅ | Raspberry Pi 64-bit, AWS Graviton |
| Linux (musl / Alpine) | ✅ musl asset when published | ✅ (falls back to source) | ✅ | `ldd` auto-detect |
| macOS arm64 (Apple Silicon) | ✅ `snsagent-macos-arm64` | ✅ | ✅ | |
| macOS x64 (Intel) | ✅ `snsagent-macos-x64` | ✅ | ✅ | |
| Windows x64 | ✅ `snsagent-windows-x64.exe` | ✅ (via npm) | ✅ (WSL) | Native binary runs on Windows |
| Windows ARM64 | ❌ | ❌ | ✅ (WSL2) | No ARM64 asset yet |
| Android / Termux | ❌ (glibc binary can't run on bionic) | ❌ (detected + skipped) | ✅ | **Source build only** — see [termux.md](./termux.md) |

Requirement summary: **npm** needs Node.js ≥ 18; **from source** needs Bun ≥ 1.3.14 and Git.

## Method 1 — npm (recommended for most users)

```bash
npm install -g @sns-myagent/cli
snsagent --version
```

The postinstall (`scripts/fetch-binary.mjs`) downloads the matching prebuilt binary from the
latest GitHub release and wires up the `snsagent` command. Expected output:

```text
snsagent 0.3.10
```

If the download was skipped (offline, rate-limited, or Termux), npm still completes — retry
later with:

```bash
npm rebuild @sns-myagent/cli
```

Bun users can install the same package:

```bash
bun add -g @sns-myagent/cli
snsagent --version
```

## Method 2 — one-liner installer (Linux / macOS / WSL)

```bash
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```

- Downloads the latest release asset, verifies it with `snsagent --version`, and falls back
  to a from-source build with Bun when no asset matches.
- Installs to `$INSTALL_DIR` (default `~/.local/bin`, override with `SNS_INSTALL_DIR=/path`).
- Honors `GITHUB_TOKEN` for rate-limited environments.
- On Termux it detects Android and routes straight to a source build.

After installing, reload your shell or `export PATH="$HOME/.local/bin:$PATH"`.

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex
```

## Method 3 — from source (the official path)

Works on every platform including Termux. Requires Bun ≥ 1.3.14 and Git.

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts --version
```

Run without installing:

```bash
bun run src/cli/entry.ts
```

Build the standalone binary:

```bash
bun run build
./bin/snsagent-linux-x64 --version
```

`bun run build` produces `bin/snsagent-linux-x64` and copies it to `bin/snsagent`.

## Method 4 — Docker

A `Dockerfile` is available in the repo for containerized runs:

```bash
docker build -t snsagent .
docker run --rm -it \
  -v ~/.omp:/root/.omp \
  -v "$(pwd)":/workspace -w /workspace \
  snsagent
```

> Note: the interactive TUI needs a TTY (`docker run -it`). For headless/CI usage pass a
> prompt or use `telegram start` with a bot token.

## Per-OS notes

### Linux (x64 / arm64)

```bash
npm install -g @sns-myagent/cli
```

Alpine/musl: the postinstall detects musl via `ldd` and prefers the musl asset when the
release publishes one, otherwise falls back to a source build.

### macOS (Apple Silicon / Intel)

```bash
npm install -g @sns-myagent/cli
```

Both arm64 and x64 assets are published; the postinstall picks by `process.arch`.

### Windows (native + WSL2)

Native (requires Node.js ≥ 18):

```powershell
npm install -g @sns-myagent/cli
snsagent --version
```

WSL2 (Ubuntu/Debian):

```bash
sudo apt update && sudo apt install -y curl git unzip
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```

### Android / Termux

The prebuilt binaries are **glibc-linked** and cannot exec under Android's bionic libc. Both
`install.sh` and the npm postinstall detect Termux and skip the download; **build from
source** instead. Full guide: [termux.md](./termux.md).

## First run

```bash
snsagent
```

The setup wizard opens: pick a provider (or the **BYOK** tab for a custom Base URL + API
key), pick a model, and start chatting. Or set a key in the environment to skip it:

```bash
export OPENAI_API_KEY="your-key-here"   # or ANTHROPIC_API_KEY, etc.
snsagent
```

## Verify an install

```bash
snsagent --version   # -> snsagent 0.3.10
snsagent --help
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `snsagent: platform binary not found. Expected …` | The postinstall didn't fetch a binary. Run `npm rebuild @sns-myagent/cli` (online), or build from source. On Termux the message says so explicitly — use the source path. |
| `EACCES` on global npm install | Use a version manager (nvm/volta) or `sudo npm install -g` — better: `npm config set prefix ~/.npm-global` and add it to PATH. |
| `bun: command not found` | `curl -fsSL https://bun.sh/install | bash`, then reload the shell. |
| `node: command not found` / node too old | npm requires Node ≥ 18. Install via nvm or your package manager. |
| Installer says "no matching asset" | The latest GitHub release may not have your platform/arch. Use the source path. |
| `snsagent` not on PATH after npm install | npm global bin dir may be missing from PATH — `npm bin -g`, then add that directory. |
| Interactive TUI doesn't render | The compiled binary runs in JS-only mode (native pty addon not embedded). Use the source path (`bun run src/cli/entry.ts`) for the interactive UI — see [troubleshooting.md](./troubleshooting.md). |

## Uninstall

```bash
npm uninstall -g @sns-myagent/cli     # npm
bun remove -g @sns-myagent/cli        # bun
```

Runtime settings and sessions are separate from the package. See
[configuration.md](./configuration.md) before removing `~/.omp/agent` or `.sns-myagent`.
