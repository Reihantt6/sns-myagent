# Frequently Asked Questions

## General

### What is snsagent?

snsagent is a single-user BYOK coding agent CLI. It supports multiple LLM providers, tools, memory backends, MCP servers, Telegram, and terminal workflows.

### How is this different from other agent CLIs?

snsagent is designed for conversational setup and single-user terminal work. You can configure providers through `/setup` or edit the local provider files directly.

### Can I use it without a hosted API key?

Yes, when you have a local or no-auth OpenAI-compatible endpoint such as Ollama. Configure that endpoint in `/setup` or `~/.omp/agent/models.yml`.

> **Tip**: start with a local endpoint (for example Ollama on `http://127.0.0.1:11434/v1`) to evaluate snsagent without any API key.

## Installation

### What are the minimum requirements?

- Node.js 18 or newer for the npm package
- Bun 1.3.14 or newer for source builds
- Git for source builds
- A network connection for hosted LLM providers

### Do I need Bun to install the published package?

No. The normal path is:

```bash
npm install -g @sns-myagent/cli
snsagent --version
```

Bun is needed for `bun run build`, source execution, and the Bun package manager path.

### Can I run it on Windows?

Yes. Use the PowerShell installer or npm. WSL is also supported by the shell installer.

## Usage

### Which command starts the agent?

```bash
snsagent
```

Use `snsagent --help` for top-level CLI commands. In the interactive TUI, `/help` opens the shortcut list and the command palette provides slash-command discovery.

### How do I configure a provider?

Run:

```text
/setup
```

The setup flow accepts a Base URL, API key when required, API type, and model. You can also edit `~/.omp/agent/models.yml`.

### Where is my data stored?

The interactive agent normally uses `~/.omp/agent` for `config.yml`, `models.yml`, sessions, memory state, and the SQLite `agent.db`. The legacy router may create `.sns-myagent/config.json` in the current project.

### Can I add my own skills?

Yes. Skills are discovered through the capability and extensibility system. See the skill documentation in the repository and use the configured skills directory for your installation.

### How do I switch models?

Use `/model` or `/switch` in the interactive agent. To assign the orchestration role, set `modelRoles.default` in `~/.omp/agent/config.yml`.

### Can I use multiple providers simultaneously?

A session has one active model at a time, but provider and model definitions can contain multiple providers. Use `/model` or `/switch` to change the active model.

### Does it support streaming responses?

Yes. The interactive agent streams provider responses when supported by the selected model and API.

### Which memory backend should I use?

- **mnemopi**: local SQLite-backed memory with embeddings and graph features.
- **local**: local rollout summary memory.
- **off**: disable memory.
- **hindsight**: remote memory service.
- **mnemosyne**, **mem0**, and **lcm**: available backend integrations with their own runtime or service requirements.

> **Tip**: `mnemopi` is the fully integrated local backend. It survives process restarts and feeds recalled facts back into the model context automatically. Choose `off` if you want no memory subsystem at all (the schema default).

## TBM

### What is TBM?

The Token Budget Manager (`src/tbm/`) manages context-delta accounting, context pyramids, lazy skills, tool-output compression, communication modes, tombstoning, and response caching. It is integrated into the main agent loop: `createAgentSession` wires it into the pre-model `transformContext`, post-tool compression, and the post-turn response cache via `src/tbm/session-hooks.ts`. The master switch defaults to **OFF**, so existing sessions are byte-for-byte unchanged until you opt in with `tbm.enabled: true`.

See [tbm.md](tbm.md) for the wiring, limitations, and the test suite.

## Memory

### Can I back up memories?

First identify the active backend and database path in `~/.omp/agent/config.yml`. For mnemopi, back up the relevant SQLite database while the agent is stopped.

### Can I export memories?

The available export and maintenance commands depend on the selected backend. Use `/memory` and `/memory stats` to inspect the active backend.

## Security

### Is my data sent anywhere?

Local configuration, sessions, and memory stay on the local machine unless you explicitly configure a remote service or share a session. Prompts and tool data are sent to the selected LLM provider as required for a request.

### Are API keys safe?

Keep keys in environment variables or local configuration excluded by `.gitignore`. Never paste real keys into committed documentation or source files.

### Can someone access my agent?

The interactive CLI is single-user and local. Protect the machine, agent directory, provider credentials, Telegram token, and any service configuration.

> **Warning**: the Telegram bridge and collab sessions are network-visible surfaces. Keep `SNS_TELEGRAM_ALLOWED_USERS` set, and review the security model before exposing any service on a shared network.
