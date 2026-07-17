# Termux Installation Guide

> Run SNS-MyAgent on Android via Termux — full coding agent on your phone.

## Prerequisites

| Requirement | Install | Verify |
|---|---|---|
| **Termux** | [F-Droid](https://f-droid.org/en/packages/com.termux/) (recommended) or [GitHub releases](https://github.com/termux/termux-app/releases) | Open app |
| **Bun** | Via install script below | `bun --version` |
| **Git** | `pkg install git` | `git --version` |

**⚠️ Important**: Use **F-Droid Termux**, NOT the Play Store version. The Play Store version is deprecated and broken.

## Step-by-Step

### 1. Install Termux

Download from [F-Droid](https://f-droid.org/en/packages/com.termux/) or install the F-Droid app first, then search "Termux".

### 2. Update packages

```bash
pkg update && pkg upgrade -y
```

### 3. Install dependencies

```bash
pkg install -y git nodejs-lts openssh
```

### 4. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version  # should show >= 1.3.14
```

If `bun` not found after install, restart Termux or run:
```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### 5. Install SNS-MyAgent

**Option A — npm (recommended for Termux)**

```bash
npm install -g @sns-myagent/cli
snsagent --version
```

**Option B — Bun global**

```bash
bun add -g @sns-myagent/cli
snsagent --version
```

**Option C — Source build**

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts --version
```

### 6. First-run setup (BYOK)

```bash
snsagent init
```

This interactive wizard asks:
1. **Memory backend** — pick `mnemopi` (default, works great on Android)
2. **AI Provider** — enter Base URL + API Key + API type

Example for OpenAI:
```
● Base URL [https://api.openai.com/v1]: ← press Enter
● API Key: sk-...your-key-here
● API Type: 1 ← press Enter (openai-completions)
```

Example for OpenRouter (supports many models):
```
● Base URL [https://api.openai.com/v1]: https://openrouter.ai/api/v1
● API Key: sk-or-...your-key-here
● API Type: 1
```

Example for local Ollama (requires a server):
```
● Base URL [https://api.openai.com/v1]: http://192.168.1.100:11434/v1
● API Key: none ← press Enter
● API Type: 1
```

### 7. Run

```bash
snsagent
```

## Termux-specific Tips

### Storage access

```bash
termux-setup-storage
```

This creates `~/storage/` symlinks to shared, downloads, etc. Required for file operations.

### SSH into your phone

Run an SSH server on your phone for remote access from a laptop:

```bash
sshd
# Connect from laptop: ssh -p 8022 phone-ip-address
```

### Performance

- **Keyboard**: Install [Hacker's Keyboard](https://f-droid.org/en/packages/org.pocketworkstation.dict.pocketworkstation/) for Ctrl/Tab/Escape keys
- **Memory**: mnemopi (SQLite) runs fine on phones. Avoid memory-heavy local models.
- **Battery**: Use cloud LLM (OpenAI/OpenRouter) — local models drain battery fast

### Background sessions

Termux kills background processes. To keep snsagent running:

```bash
# Use Termux:Boot (install from F-Droid)
# Create boot script:
mkdir -p ~/.termux/boot
echo 'snsagent telegram start --token YOUR_TOKEN' > ~/.termux/boot/snsagent.sh
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `bun: command not found` | `source ~/.bashrc` or restart Termux |
| `npm install fails` | `pkg install nodejs-lts` then retry |
| `Cannot find module` | `cd sns-myagent && bun install` |
| `Permission denied` | `chmod +x bin/snsagent-linux-x64` or use `bun run src/cli/entry.ts` |
| `Out of memory` | Use cloud LLM, avoid local models |
| `Keyboard lacks Esc` | Install Hacker's Keyboard, or use Ctrl+[ as Esc |
| `Termux crashes` | Update from F-Droid, NOT Play Store |

## Minimum Phone Specs

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Android** | 7.0+ | 10+ |
| **RAM** | 2GB free | 4GB+ |
| **Storage** | 500MB free | 2GB+ |
| **Network** | Required (cloud LLM) | WiFi recommended |
