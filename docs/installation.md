# Installation Guide

## Quick Install (Recommended)

### One-liner (Linux / macOS / WSL2)
```bash
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```
Installs Node.js (via nvm if needed) + `snscoder` globally.

### npm Global Install
```bash
npm install -g snscoder
```
Then run:
```bash
snscoder
```

### npx (Run without installing)
```bash
npx snscoder
```

---

## Manual Install (Development)

### Prerequisites

| Dependency | Minimum | Recommended | Check |
|------------|---------|-------------|-------|
| **Node.js** | 20.0 | 22.x LTS | `node --version` |
| **npm** | 10.0 | Latest | `npm --version` |
| **Git** | 2.0 | Latest | `git --version` |

#### Install Node.js

**Linux / macOS (via nvm):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

**macOS (Homebrew):**
```bash
brew install node@22
```

**Windows:**
Download from [nodejs.org](https://nodejs.org) (LTS recommended).

### Clone & Setup
```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
npm install
npm run build
npm start
```

### Development Mode
```bash
npm run dev    # Watch mode with hot reload
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
- **Memory DB** grows over time. Mnemosyne (SQLite) typically 10-100 MB for personal use.
- **Local models** (Ollama) need significantly more RAM (8-16 GB+ depending on model).
- **Disk** usage depends on skills loaded and conversation history.

---

## API Keys

You need at least one LLM provider:

### Option 1: OpenAI
```bash
export OPENAI_API_KEY="sk-..."
```

### Option 2: Anthropic
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Option 3: Local (Ollama) — No API key needed
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3
```
Then tell the agent: *"setup ollama with llama3"*

### Option 4: Custom provider
Any OpenAI-compatible API (vLLM, llama.cpp server, LM Studio, etc.)

### .env file
Create `.env` in project root:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk--ant-...
```

---

## Verify Installation

```bash
# Check versions
node --version     # >= 20.0
npm --version      # >= 10.0
snscoder --version # 0.1.0

# Test run
snscoder
# Type: "hello" → agent should respond
```

---

## Uninstall

```bash
npm uninstall -g snscoder

# Remove data
rm -rf ~/.sns-myagent
```
