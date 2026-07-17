# Configuration Reference

## Location

| File | Purpose |
|------|---------|
| `./config.yaml` | Project-level config |
| `~/.sns-myagent/config.yaml` | User-level config (fallback) |
| `.env` | Environment variables |

Priority: Project config > User config > Environment variables > Defaults

---

## Full Config Reference

### BYOK Quick Setup

The fastest way to connect a provider. Run `snsagent` → Setup Wizard → **BYOK** tab:

1. Enter **Base URL** (e.g. `https://api.openai.com/v1`)
2. Enter **API Key**
3. Select **API type** (default: `openai-completions`)

The wizard calls the provider's `/models` endpoint, auto-detects available models, and writes `~/.sns-myagent/models.yml`.

Manual equivalent — create `~/.sns-myagent/models.yml`:

```yaml
providers:
  my-provider:
    baseUrl: https://api.openai.com/v1
    apiKey: sk-...
    api: openai-completions
    models:
      - id: gpt-4o
        contextWindow: 128000
        supportsTools: true
```

Supported API types:
| API Type | Use For |
|----------|---------|
| `openai-completions` | OpenAI, OpenRouter, Ollama, vLLM, LM Studio, any compatible |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Claude |
| `google-generative-ai` | Google Gemini |
| `azure-openai-responses` | Azure OpenAI |

---

```yaml
# ── LLM Providers ─────────────────────────────────────────────
providers:
  openai:
    api_key: ${OPENAI_API_KEY}
    model: gpt-4o

  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-20250514

  custom:
    base_url: http://localhost:11434/v1   # Ollama default
    model: llama3
    api_key: none

# ── Default provider ──────────────────────────────────────────
default_provider: openai

# ── Tools ─────────────────────────────────────────────────────
tools:
  terminal:
    allowed_commands:
      - ls
      - cat
      - git
      - bun
      - python3
      - curl
    blocked_commands:
      - rm -rf /
      - shutdown
    require_approval: true    # Ask before executing

  browser:
    headless: true

  web_search:
    provider: duckduckgo      # or: brave, serpapi

# ── Memory ────────────────────────────────────────────────────
memory:
  enabled: true
  backend: mnemopi            # mnemopi | mnemosyne | mem0 | lcm
  db_path: ~/.sns-myagent/memory.db
  max_working_entries: 50
  auto_summarize: true

# ── Skills ────────────────────────────────────────────────────
skills:
  directory: ./skills
  auto_load: []               # Skills loaded on startup

# ── MCP ───────────────────────────────────────────────────────
mcp:
  servers: []
  # Example:
  # - name: filesystem
  #   command: npx
  #   args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]

# ── Cron ──────────────────────────────────────────────────────
cron:
  enabled: true

# ── UI ────────────────────────────────────────────────────────
ui:
  theme: dark                 # dark | light
  streaming: true
  code_highlight: true
  markdown_render: true

# ── Token Budget Manager (Planned — Phase 3) ─────────────────
# tbm config not yet implemented; see docs/tbm.md for design target
```

---

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `<your-openai-key>` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `<your-anthropic-key>` |
| `SNS_MODEL` | Override default model | `claude-sonnet-4-20250514` |
| `SNS_PROVIDER` | Override default provider | `anthropic` |
| `SNS_CONFIG_PATH` | Custom config file path | `/etc/sns/config.yaml` |
| `SNS_MEMORY_DB` | Custom memory database path | `/data/sns/memory.db` |

---

## Conversational Configuration

You don't need to edit config manually. Tell the agent:

- *"add MCP filesystem for /home/user/projects"*
- *"switch memory to Mem0"*
- *"setup ollama with llama3"*
- *"add anthropic with claude-sonnet"*

- *"switch to gpt-4o"*

The agent handles: dependency install → config update → connection test → confirmation.
