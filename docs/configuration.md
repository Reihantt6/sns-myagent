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
      - npm
      - node
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
  backend: mnemosyne          # mnemosyne | mem0 | lcm
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

# ── Token Budget Manager ─────────────────────────────────────
tbm:
  enabled: true
  mode: auto                  # auto | caveman | normal | verbose
  context_delta_cache: true
  tool_output_budget:
    terminal: 500
    read_file: 800
    web_extract: 1000
    search_files: 300
  lazy_skill_loading: true
  response_cache:
    enabled: true
    ttl: 300
    semantic_threshold: 0.95
  pyramid:
    start_level: 0
    auto_escalate: true
    max_level: 4
  tombstoning:
    enabled: true
    threshold: 50
  dashboard:
    show_per_turn: false
```

---

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
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
- *"enable caveman mode"*
- *"switch to gpt-4o"*

The agent handles: dependency install → config update → connection test → confirmation.
