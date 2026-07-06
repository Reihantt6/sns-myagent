# Installation Guide

> **Dual-runtime supported.** Pick the path that matches your stack. Both paths end with the same `snscoder` binary on your `$PATH`.

| Path | Best for | Prerequisite |
|------|----------|--------------|
| **Bun** (recommended) | Linux / macOS / WSL contributors | Bun >= 1.3.14 |
| **Node.js / npm** | Windows users, CI/CD, anyone without Bun | Node.js >= 18 |
| **Source build** | Maintainers, custom builds | Bun >= 1.3.14 + Git |

## Universal Install (npm, all platforms)

Works on Linux, macOS, Windows, and WSL2 without any Bun dependency.

```bash
npm install -g @sns-myagent/cli
```

The `postinstall` hook (`scripts/fetch-binary.mjs`) downloads the matching platform prebuilt binary into the package's `bin/` directory and chmods it executable. The shim `bin/snscoder.js` (which `npm link` exposes as `snscoder`) spawns the binary and forwards stdio + exit code.

If GitHub release `v0.1.0` hasn't been published yet, the postinstall prints a warning and exits 0 — your `npm install` still succeeds. Re-run `npm rebuild` once the maintainer publishes.

**Force-refetch the binary on demand:**

```bash
npm rebuild @sns-myagent/cli    # or: npm run fetch-binary
```

## Quick Install (Recommended)

### One-liner (Linux / macOS / WSL2)

```bash
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```

Installs Bun (>= 1.3.14) if needed + `snscoder` globally.

### Bun Global Install

```bash
bun add -g snscoder
```

Then run:

```bash
snscoder
```

### bunx (Run without installing)

```bash
bunx snscoder
```

---

## Manual Install (Development)

### Prerequisites

| Dependency | Minimum | Recommended | Check |
|------------|---------|-------------|-------|
| **Bun** *(for building)* | 1.3.14 | Latest | `bun --version` |
| **Node.js** *(for npm path)* | 18.0 | 22.x LTS | `node --version` |
| **Git** | 2.0 | Latest | `git --version` |
| **TypeScript** | 5.x | 6.x | bundled via `devDependencies` |

At runtime you need **either** Bun **or** Node.js — not both. Use Bun for `bun add -g @sns-myagent/cli`, use Node for `npm install -g @sns-myagent/cli`. Both paths produce the same `snscoder` command.

### Install Bun

Bun is the runtime, package manager, test runner, and bundler. Install once:

**Linux / macOS (official installer):**

```bash
curl -fsSL https://bun.sh/install | bash
```

**macOS (Homebrew):**

```bash
brew install bun
```

**Windows (PowerShell):**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Install Node.js *(for the npm path)*

If you don't have Node.js 18+ yet, get it from [nodejs.org](https://nodejs.org/) (LTS recommended) or via a version manager:

**macOS (Homebrew):**
```bash
brew install node@22
```

**Linux (nvm):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

### Windows Installer (`install.ps1`)

The recommended Windows experience uses npm + the postinstall binary fetch — no Bun required:

```powershell
irm raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex
```

The script verifies Node.js 18+, runs `npm install -g @sns-myagent/cli`, and prints a `snscoder --version` verification. Pass `-UseBun` if you already have Bun installed and want the Bun path instead.

### Clone & Build

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run build          # produces dist/cli.js (the snscoder binary)
snscoder               # or: bun dist/cli.js
```

### Development Mode

```bash
bun run dev    # Watch mode
bun test       # Run test suite (parallel=4)
```

---

## Recommended Specs

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 2 GB free | 4 GB+ |
| **Disk** | 500 MB | 2 GB+ (for skills + memory DB) |
| **CPU** | Any modern CPU | 2+ cores |
| **OS** | Linux, macOS, Windows (WSL2) | Ubuntu 22.04+, macOS 14+ |
| **Network** | Required for cloud LLM | Broadband recommended |

### Notes

- **Memory DB** grows over time. mnemopi (SQLite) typically 10-100 MB for personal use.
- **Local models** (Ollama) need significantly more RAM (8-16 GB+ depending on model).
- **Disk** usage depends on skills loaded and conversation history.

---

## API Keys

You need at least one LLM provider:

### Option 1: OpenAI

```bash
export OPENAI_API_KEY="<your-openai-key>"
```

### Option 2: Anthropic

```bash
export ANTHROPIC_API_KEY="<your-anthropic-key>"
```

### Option 3: Local (Ollama) — No API key needed

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3
```

Then tell the agent: *"setup ollama with llama3"*

### Option 4: Custom provider

Any OpenAI-compatible API (vLLM, llama.cpp server, LM Studio, OpenRouter, etc.)

**Fastest way**: Run `snscoder` → Setup Wizard → **BYOK** tab. Enter Base URL + API Key, done.

**Manual**: Create `~/.sns-myagent/models.yml`:

```yaml
providers:
  my-provider:
    baseUrl: https://openrouter.ai/api/v1
    apiKey: sk-or-...
    api: openai-completions
```

### .env file

Create `.env` in project root:

```
OPENAI_API_KEY=<your-openai-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
```

---

## Verify Installation

```bash
# Check versions
bun --version      # >= 1.3.14
snscoder --version # 0.1.0

# Test run
snscoder
# Type: "hello" → agent should respond
```

---

## Uninstall

```bash
bun remove -g snscoder

# Remove data
rm -rf ~/.sns-myagent
```