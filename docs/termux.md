# Termux Installation Guide

Run snsagent on Android through Termux.

## Prerequisites

| Requirement | Install | Verify |
|---|---|---|
| **Termux** | [F-Droid](https://f-droid.org/en/packages/com.termux/) or [GitHub releases](https://github.com/termux/termux-app/releases) | Open the app |
| **Node.js** | `pkg install nodejs-lts` | `node --version` |
| **Bun** | Source-build option below | `bun --version` |
| **Git** | `pkg install git` | `git --version` |

Use a current F-Droid or GitHub Termux release. The old Play Store build is not maintained.

## Why the npm / prebuilt binary does not run on Android

The `@sns-myagent/cli` postinstall and `install.sh` both download a prebuilt
`snsagent-linux-arm64` asset that is compiled with `bun build --compile` on
GitHub's `ubuntu-latest` runner. That artifact is **glibc-linked** and will not
exec under Android's bionic libc, so `snsagent --version` fails on Termux.

The installer (`curl ... | bash`) detects Termux and skips the prebuilt path,
falling back to a from-source build. Use the source path below instead.

## Run from source (recommended)

```bash
pkg install -y nodejs-lts git
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts --version
```

## First-run setup

From the cloned repo:

```bash
bun run src/cli/entry.ts
```

Use `/setup` to configure a provider, or edit `~/.omp/agent/models.yml`. For a local Ollama-compatible endpoint, use the endpoint URL and select `openai-completions`. Do not place a real key in this document or in a committed file.

## Termux-specific tips

### Storage access

```bash
termux-setup-storage
```

### SSH server

```bash
sshd
# Connect from a laptop with: ssh -p 8022 phone-ip-address
```

### Background sessions

Termux can stop background processes. For a boot workflow, install Termux:Boot and create a script under `~/.termux/boot/` that starts the command you need, for example:

```bash
mkdir -p ~/.termux/boot
echo 'cd ~/sns-myagent && bun run src/cli/entry.ts telegram start --token YOUR_TOKEN' > ~/.termux/boot/snsagent.sh
chmod +x ~/.termux/boot/snsagent.sh
```

Replace `YOUR_TOKEN` with the bot token (keep it out of any committed file).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `bun: command not found` | `export PATH="$HOME/.bun/bin:$PATH"` or restart Termux |
| `npm install fails` | `pkg install nodejs-lts git` and retry |
| `Permission denied` | Run the source entrypoint with Bun (`bun run src/cli/entry.ts`) |
| `Out of memory` | Use a hosted LLM and avoid local model inference |
| `Keyboard lacks Esc` | Install Hacker's Keyboard, or use Ctrl+[ as Esc |
| `Termux crashes` | Update Termux from F-Droid or GitHub |

## Minimum phone specs

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Android** | 7.0+ | 10+ |
| **RAM** | 2 GB free | 4 GB+ |
| **Storage** | 500 MB free | 2 GB+ |
| **Network** | Required for hosted LLM | WiFi recommended |