# Running snsagent

How to launch, configure, and operate the agent day to day.

## Launch modes

| Mode | Command | What it does |
|---|---|---|
| Interactive (default) | `snsagent` | Full terminal UI — chat, tools, slash commands |
| Alias | `snsagent agent` / `snsagent launch` | Same as default |
| One-shot / orchestrate | `snsagent orchestrate "<prompt>"` | Multi-agent ensemble run, prints result, exits |
| Telegram bot | `snsagent telegram start` | Starts polling; also auto-starts when `SNS_TELEGRAM_BOT_TOKEN` is set |
| Version / help | `snsagent --version`, `snsagent --help` | Fast, no config needed |
| Init / setup | `snsagent init` (alias `snsagent setup`) | Create config + connect a provider (BYOK) |
| Config CLI | `snsagent config show` / `config get <key>` / `config set <key> <value>` | Inspect and edit settings from the shell |

## Provider setup

### Setup wizard (interactive)

```bash
snsagent
```

First launch (or `/setup`) opens the wizard:

1. Choose a provider — OpenAI, Anthropic, Google, or the **BYOK** tab for a custom endpoint.
2. BYOK: enter Base URL + API key (Tab between fields, Enter connects, ↑↓ changes API type).
   Local providers (localhost / 127.0.0.1) work with no key.
3. Pick a model. Providers are saved to `~/.omp/agent/models.yml`.

### Environment variables

The agent picks up standard provider keys on launch:

```bash
export OPENAI_API_KEY="..."
export ANTHROPIC_API_KEY="..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
snsagent
```

### Conversation-driven configuration

Ask the agent to configure itself:

```text
> add MCP filesystem for /home/user/projects
> switch to anthropic with claude-sonnet
> load coding skill
```

## Memory backends

Memory is selected with `memory.backend` (default `off`). Change it via `/settings` or by
editing `~/.omp/agent/config.yml`:

| Backend | What it is | Auto-recall |
|---|---|---|
| `off` | No persistence — nothing is written | — |
| `mnemopi` | Local SQLite (lexical + vector + graph); the fully-integrated backend | ✅ first-turn injection + compaction recall |
| `hindsight` | Remote memory service | ✅ |
| `mem0` / `lcm` / `local` | Manual save/search only | ❌ |
| `mnemosyne` | Deprecated — migrated to `mnemopi` at config load | — |

Common commands: `/memory` (status), `/memory clear`, `/memory enqueue`, `/memory stats`.

See [memory.md](./memory.md) for details.

## TBM (token budget manager)

TBM tracks token spend, caches context deltas, and compresses tool output. Default **OFF** —
opt in with:

```yaml
# ~/.omp/agent/config.yml
tbm:
  enabled: true
```

| Command | What it shows |
|---|---|
| `/tokens` | Full dashboard — session, input/cached tokens, est. cost, cache hit rate, pyramid level, compression, tombstones, skills |
| `/tokens compact` | Compact one-liner for the status bar |
| `/mode` | Communication mode: caveman / normal / verbose / auto |

The cache hit rate in `/tokens` is the real measured rate (context-delta hits ÷ turns), not a
guess. See [tbm.md](./tbm.md) for the full design.

## Common slash commands

| Command | Purpose |
|---|---|
| `/help` | List every command |
| `/setup` | Re-open provider setup |
| `/settings` | Open the settings panel |
| `/model` / `/switch` | Change model or provider mid-session |
| `/plan` | Plan-first mode (research before acting) |
| `/goal set <objective>` | Set a long-running goal with a token budget |
| `/todo` | Track tasks |
| `/memory` | Memory status + subcommands |
| `/tokens` | TBM dashboard |
| `/compact` | Compact the session context |
| `/browser` | Toggle visible/headless browser mode |
| `/task run <description>` | Spawn an async subagent in the background |
| `/export` | Export the session |
| `/share` / `/collab` | Share a read-only link or start a collab session |

## Config locations

| Thing | Location |
|---|---|
| Interactive config | `~/.omp/agent/config.yml` |
| Providers + models | `~/.omp/agent/models.yml` |
| Sessions | `~/.omp/agent/sessions/` |
| Memory data (mnemopi) | `~/.omp/agent/mnemopi/` |
| MCP / SSH configs | `~/.omp/agent/mcp.json`, `~/.omp/agent/ssh.json` |
| Init-flow config | `.sns-myagent/config.json` (project-local) |
| Daemon secrets (systemd) | `/etc/snsagent/secrets.env` (chmod 600) |

Per-OS roots: `~` is your home directory on Linux/macOS, `%USERPROFILE%` on Windows, and
`/data/data/com.termux/files/home` on Termux.

## Updating

```bash
npm update -g @sns-myagent/cli        # npm installs
bun update -g @sns-myagent/cli        # bun
```

Source installs: `git pull && bun install` and re-run `bun run build` if you use the
compiled binary.

## Uninstalling

```bash
npm uninstall -g @sns-myagent/cli     # npm
bun remove -g @sns-myagent/cli        # bun
```

Your config and sessions under `~/.omp/agent/` are kept — remove them separately if you want
a full wipe.

## Troubleshooting

- `snsagent: platform binary not found` — see [installation.md](./installation.md#troubleshooting).
- TUI doesn't render from the compiled binary — JS-only mode; run `bun run src/cli/entry.ts`.
- Telegram auth — without `SNS_TELEGRAM_ALLOWED_USERS` the bot is open to anyone; see
  [security-model.md](./security-model.md).
