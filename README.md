<p align="center">
  <pre>
  ╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║    ███████╗███╗   ██╗███████╗    ██╗   ██╗██╗   ██╗          ║
  ║    ██╔════╝████╗  ██║██╔════╝    ██║   ██║╚██╗ ██╔╝          ║
  ║    ███████╗██╔██╗ ██║███████╗    ██║   ██║ ╚████╔╝           ║
  ║    ╚════██║██║╚██╗██║╚════██║    ╚██╗ ██╔╝  ╚██╔╝           ║
  ║    ███████║██║ ╚████║███████║     ╚████╔╝    ██║             ║
  ║    ╚══════╝╚═╝  ╚═══╝╚══════╝      ╚═══╝     ╚═╝             ║
  ║                                                              ║
  ║            A G E N T                                         ║
  ║                                                              ║
  ║    Configure your agent by talking to it.                    ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝
  </pre>
</p>

<p align="center">
  <strong>BYOK coding agent CLI — 30 built-in tools, 58 slash commands, multi-provider LLM, memory, MCP, Telegram.</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/version-0.1.0-yellow?style=flat-square" alt="Version 0.1.0">
  <img src="https://img.shields.io/badge/bun-%3E%3D1.3.14-efbbf4?style=flat-square&logo=bun&logoColor=black" alt="Bun >= 1.3.14">
  <img src="https://img.shields.io/badge/typescript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.x">
</p>

---

**snscoder** is a personal, single-user AI coding agent CLI. Bring your own API key, talk to the agent, and it configures itself — MCP servers, memory backends, model switching, all through conversation. Forked from [Pi Agent / oh-my-pi](https://github.com/can1357/oh-my-pi) and stripped to a focused, local-first, terminal-first agent.

---

## Table of Contents

- [Features](#features)
- [Tools](#tools-30-built-in)
- [Slash Commands](#slash-commands)
- [Memory Backends](#memory-backends)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [CLI Reference](#cli-reference)
- [MCP Integration](#mcp-integration)
- [Telegram](#telegram)
- [Architecture](#architecture)
- [Development](#development)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Credits](#credits)

---

## Features

| Feature | Source |
|---------|--------|
| **30 built-in tools** | `src/tools/builtin-names.ts` |
| **58 slash commands** | `src/slash-commands/builtin-registry.ts` |
| **Multi-provider LLM** | OpenAI, Anthropic, Ollama, custom endpoints via `@oh-my-pi/pi-ai` |
| **4 memory backends** | mnemopi (default), hindsight, local, off — `src/memory-backend/resolve.ts` |
| **MCP integration** | 22 source files in `src/mcp/` |
| **Plan mode** | `src/plan-mode/` — agent plans before executing |
| **Goal mode** | Autonomous objective with token budget and lifecycle |
| **Subagent delegation** | `src/task/` — spawn child agents for parallel work |
| **Advisor** | Second model reviews each turn and injects notes |
| **Collaborative sessions** | `src/collab/` — host/join sessions via link or QR code |
| **Skills & plugins** | `src/extensibility/` — markdown skills + plugin marketplace |
| **Auto-learning** | `src/autolearn/` — agent learns from interactions |
| **Browser automation** | Puppeteer-based headless browser — `src/tools/` browser tool |
| **LSP integration** | Language Server Protocol — `src/lsp/` |
| **Eval backends** | Python, Ruby, Julia, JavaScript — `src/eval/` |
| **SSH remote execution** | `src/ssh/` |
| **Text-to-speech** | 10 files in `src/tts/` |
| **TinyLLM local inference** | 7 files in `src/tiny/` |
| **Telegram bot** | `src/adapters/telegram/` — auto-boot with `SNS_TELEGRAM_BOT_TOKEN` |
| **Debug Adapter Protocol** | `src/dap/` |
| **Context compaction** | Automatic context window management with multiple strategies |
| **IRC** | IRC tool for chat protocol interaction |
| **Todo system** | Markdown-based todo list with reminders |

---

## Tools (30 Built-in)

All tool names come from `src/tools/builtin-names.ts`.

### File & Code Operations

| Tool | Description |
|------|-------------|
| `read` | Read file contents with line ranges |
| `write` | Write / create / append to files |
| `edit` | Find-and-replace edits in files |
| `find` | Find files by name or pattern |
| `search` | Search file contents (regex) |

### Shell & Execution

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands |
| `eval` | Evaluate code snippets (Python, JS, Ruby, Julia) |
| `ssh` | Execute commands on remote hosts via SSH |

### Code Intelligence

| Tool | Description |
|------|-------------|
| `ast_grep` | AST-based code search |
| `ast_edit` | AST-aware code editing |
| `lsp` | Language Server Protocol operations |
| `debug` | Debugging assistance |

### Web & Browser

| Tool | Description |
|------|-------------|
| `web_search` | Web search via configured provider |
| `search` | File/content search |
| `search_tool_bm25` | BM25-based search tool |
| `browser` | Headless browser automation (Puppeteer) |
| `inspect_image` | Image analysis |

### Memory & Learning

| Tool | Description |
|------|-------------|
| `memory_edit` | Edit memory entries |
| `retain` | Store information in memory |
| `recall` | Retrieve information from memory |
| `reflect` | Self-reflection on past actions |
| `learn` | Learn from interactions |
| `manage_skill` | Manage skill files |

### Sessions & Tasks

| Tool | Description |
|------|-------------|
| `task` | Spawn subagent for delegated work |
| `job` | Manage background jobs |
| `checkpoint` | Save session checkpoint |
| `rewind` | Rewind to a previous checkpoint |

### Communication & Other

| Tool | Description |
|------|-------------|
| `irc` | IRC chat protocol |
| `todo` | Markdown todo list management |
| `github` | GitHub operations (repos, issues, PRs) |
| `ask` | Ask clarifying questions |

---

## Slash Commands

58 built-in commands from `src/slash-commands/builtin-registry.ts`. Most useful:

### Session & Navigation

| Command | Description |
|---------|-------------|
| `/compact` | Compact conversation context |
| `/context` | Show context-window breakdown |
| `/copy` | Copy last response to clipboard |
| `/export` | Export session to file |
| `/dump` | Dump raw session transcript |
| `/share` | Share session via collab link |
| `/reset` | Reset session |
| `/help` | Show help |

### Model & Provider

| Command | Description |
|---------|-------------|
| `/model` | Switch model for this session |
| `/switch` | Quick model switch (same as alt+p) |
| `/fast [on\|off\|status]` | Toggle priority service tier |
| `/settings` | Open settings menu |
| `/setup` | Open provider setup wizard |

### Goals & Planning

| Command | Description |
|---------|-------------|
| `/plan` | Toggle plan mode |
| `/plan-review` | Review the active plan |
| `/goal <set\|show\|pause\|resume\|drop\|budget>` | Goal lifecycle management |
| `/guided-goal` | Guided goal walkthrough |
| `/loop [count\|duration]` | Toggle loop mode |
| `/advisor [on\|off\|status\|dump]` | Advisor subagent control |

### Output & Collaboration

| Command | Description |
|---------|-------------|
| `/collab [view\|status\|stop]` | Host a live collab session |
| `/join <link>` | Join a collab session |
| `/leave` | Leave collab session |
| `/todo <edit\|copy\|export\|import\|append\|start\|done\|drop>` | Todo list management |
| `/browser [headless\|visible]` | Switch browser mode |

### System

| Command | Description |
|---------|-------------|
| `/mcp [reload]` | MCP server status / reload |
| `/ssh` | Run command on remote host |
| `/plugins` | Show installed plugins |
| `/marketplace` | Open marketplace manager |
| `/stats [--port]` | Launch stats dashboard |
| `/usage [show\|reset]` | Token usage / rate-limit reset |
| `/version` | Show version |
| `/changelog [full]` | Show changelog entries |
| `/debug` | Toggle debug logging |
| `/theme` | Switch UI theme |
| `/unpin` | Unpin pinned context |

---

## Memory Backends

Four backends, configured via `memory.backend` in settings. Source: `src/memory-backend/resolve.ts`.

| Backend | Description | Source |
|---------|-------------|--------|
| **mnemopi** (default) | SQLite + vector embeddings + graph. Local, zero setup. | `src/mnemopi/` (7 files) |
| **hindsight** | Remote memory backend | `src/hindsight/` (5 files) |
| **local** | Rollout summary pipeline | `src/memory-backend/local-backend.ts` |
| **off** | Memory disabled | `src/memory-backend/off-backend.ts` |

### mnemopi Settings

| Key | Default | Description |
|-----|---------|-------------|
| `mnemopi.dbPath` | — | SQLite database path |
| `mnemopi.bank` | — | Memory bank |
| `mnemopi.scoping` | — | Scoping mode |
| `mnemopi.embeddingVariant` | — | Embedding model variant |
| `mnemopi.autoRecall` | — | Auto-recall on context load |
| `mnemopi.autoRetain` | — | Auto-retain after conversations |
| `mnemopi.retainEveryNTurns` | `4` | Turns between auto-retains |
| `mnemopi.recallLimit` | `8` | Max recall results |
| `mnemopi.recallContextTurns` | `3` | Context turns for recall |
| `mnemopi.recallMaxQueryChars` | `4000` | Max query characters |
| `mnemopi.injectionTokenLimit` | `5000` | Token budget for injected memories |
| `mnemopi.debug` | `false` | Debug logging |

---

## Installation

### Option 1: One-liner (Linux / macOS / WSL)

```bash
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```

Multi-arch: detects Linux x64, Linux ARM64 (Termux/Android), macOS.

### Option 2: npm (all platforms)

```bash
npm install -g @sns-myagent/cli
```

Works on Linux, macOS, Windows, WSL. Requires Node.js 18+. Prebuilt binary downloaded on install.

### Option 3: Build from source

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install        # requires Bun >= 1.3.14
bun run build      # produces bin/snscoder-linux-x64
```

### Option 4: Windows PowerShell

```powershell
irm raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex
```

Uses npm under the hood. WSL also supported via Option 1 or 2.

### Run from source (development)

```bash
bun run src/cli/entry.ts
```

### Platform Support

| Platform | Method |
|----------|--------|
| Linux x64 | Binary, npm, curl, source |
| Linux ARM64 (Termux/Android) | Binary, npm, curl, source |
| macOS | Source (Bun), npm |
| Windows | npm, PowerShell installer, WSL |

---

## Quick Start

### 1. Set an API key

```bash
export OPENAI_API_KEY="sk-..."
# or
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Run

```bash
snscoder
```

Or from source:

```bash
bun run src/cli/entry.ts
```

### 3. Use it

```
> what files are in the current directory?
> search the web for "bun runtime benchmarks"
> create a TypeScript module that parses CSV files
> refactor src/utils.ts to use async/await
```

### 4. Configure through conversation

```
> add MCP filesystem for /home/user/projects
> switch to anthropic with claude-sonnet
> load coding skill
```

---

## Configuration

Config lives at `.sns-myagent/config.json` (JSON, not YAML). Source: `src/config/loader.ts`.

### Key Config Categories

Settings use dot-separated paths. Full schema in `src/config/settings-schema.ts`.

```jsonc
{
  // Model selection
  "model.*": "...",

  // Feature toggles
  "advisor.enabled": true,
  "bash.enabled": true,
  "browser.enabled": true,
  "browser.headless": true,
  "checkpoint.enabled": true,
  "compaction.enabled": true,
  "debug.enabled": false,
  "github.enabled": true,
  "goal.enabled": true,
  "todo.enabled": true,

  // Eval backends
  "eval.py": true,
  "eval.js": true,
  "eval.rb": true,
  "eval.jl": true,

  // Memory
  "memory.backend": "mnemopi",  // "mnemopi" | "hindsight" | "local" | "off"
  "hindsight.scoping": "...",

  // MCP
  "mcp.*": {},

  // Session
  "session.*": {},

  // Theme
  "theme.dark": "titanium",

  // Compaction
  "compaction.enabled": true,
  "compaction.strategy": "...",
  "compaction.thresholdPercent": 80,
  "compaction.idleEnabled": true,
  "compaction.idleTimeoutSeconds": 300,

  // Todo
  "todo.enabled": true,
  "todo.reminders": true,
  "todo.reminders.max": 5,

  // Mnemopi (when memory.backend = "mnemopi")
  "mnemopi.dbPath": "...",
  "mnemopi.autoRecall": true,
  "mnemopi.autoRetain": true,
  "mnemopi.retainEveryNTurns": 4,
  "mnemopi.recallLimit": 8
}
```

Access in TUI via `/settings` or through conversation.

---

## CLI Reference

```
snscoder                          # Interactive TUI mode
snscoder "prompt"                 # Single-prompt mode
snscoder telegram                 # Start Telegram adapter
snscoder --help                   # Show help
snscoder --version                # Show version
```

---

## MCP Integration

Connect Model Context Protocol servers for additional tools. 22 source files in `src/mcp/`.

### Through Conversation

```
> add MCP filesystem for /home/user/projects
> add MCP github
```

### Through Config

Configure via `/mcp` or the settings panel. Servers are defined in the MCP config section.

### Popular MCP Servers

| Server | Package |
|--------|---------|
| Filesystem | `@modelcontextprotocol/server-filesystem` |
| PostgreSQL | `@modelcontextprotocol/server-postgres` |
| GitHub | `@modelcontextprotocol/server-github` |

---

## Telegram

Telegram bot adapter in `src/adapters/telegram/` (4 files). Built on [grammY](https://grammy.dev/).

### Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Set the token:

```bash
export SNS_TELEGRAM_BOT_TOKEN="your-bot-token-here"
```

3. Run snscoder — the bot auto-starts polling:

```bash
snscoder
```

The adapter starts automatically when `SNS_TELEGRAM_BOT_TOKEN` is set. Disable auto-start with:

```bash
export SNS_TELEGRAM_AUTOSTART=0
```

Or start the Telegram adapter explicitly:

```bash
snscoder telegram
```

---

## Architecture

```
sns-myagent/
├── src/
│   ├── cli/                    # CLI entry point + commands
│   ├── config/                 # Settings schema, loader, defaults
│   ├── tools/                  # 30 built-in tools
│   ├── modes/                  # Interactive mode, TUI, controllers
│   ├── session/                # Session management
│   ├── mcp/                    # MCP integration (22 files)
│   ├── prompts/                # System prompts
│   ├── memory-backend/         # Memory backend resolver
│   ├── mnemopi/                # mnemopi backend (SQLite + vector + graph)
│   ├── hindsight/              # hindsight backend (remote memory)
│   ├── extensibility/          # Skills, plugins, marketplace
│   ├── capability/             # Skill system
│   ├── task/                   # Subagent delegation
│   ├── plan-mode/              # Plan mode
│   ├── web/                    # Web search, scrapers
│   ├── ssh/                    # SSH tool
│   ├── lsp/                    # LSP tool
│   ├── eval/                   # Eval backends (Python, Ruby, Julia, JS)
│   ├── collab/                 # Collaborative sessions
│   ├── autolearn/              # Auto-learning system
│   ├── adapters/
│   │   └── telegram/           # Telegram bot adapter
│   ├── tts/                    # Text-to-speech (10 files)
│   ├── tiny/                   # TinyLLM local inference (7 files)
│   ├── dap/                    # Debug Adapter Protocol
│   ├── stt/                    # Speech-to-text
│   ├── thinking/               # Thinking mode support
│   ├── ui/                     # Terminal UI components
│   └── utils/                  # Utilities
├── docs/                       # Documentation
├── bin/                        # Prebuilt binaries
├── scripts/                    # Build + dev scripts
├── install.sh                  # Multi-arch installer
├── install.ps1                 # Windows installer
└── package.json
```

---

## Development

```bash
bun install              # Install dependencies
bun run build            # Build binary to bin/
bun run src/cli/entry.ts # Run from source
bun test                 # Run tests
bun run check            # Biome check + type check
bun run lint             # Biome lint
bun run fix              # Auto-fix lint + format
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit with clear messages
4. Push and open a Pull Request

### Commit Convention

```
add:      new feature or file
fix:      bug fix
refactor: code restructuring
docs:     documentation changes
test:     test additions or changes
chore:    maintenance tasks
```

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security policies.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Credits

Forked from [Pi Agent / oh-my-pi](https://github.com/can1357/oh-my-pi) by can1357. Stripped to a focused, single-user terminal agent with conversational configuration.
