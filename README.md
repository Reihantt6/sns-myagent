# SNS MyAgent

Personal AI agent CLI — terminal-based assistant with tool calling, multi-provider LLM support, and extensible skill system.

Forked from [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research), stripped and restructured for single-user deployment.

## Features

- **Multi-provider LLM** — OpenAI, Anthropic, local models (llama.cpp, vLLM). Switch providers without code changes.
- **Tool calling** — Terminal, web search, file operations, browser automation. Agent decides which tool to use per task.
- **Skill system** — Markdown-based skill files. Load context and workflows dynamically.
- **Persistent memory** — Mnemosyne-based memory layer. Facts persist across sessions.
- **Terminal UI** — CLI interface with colored output, code block rendering, and markdown support.
- **Extensible** — Add custom tools, skills, and providers via config.

## Requirements

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | ≥ 20.0 | Runtime |
| npm | ≥ 10.0 | Package manager |
| Python | ≥ 3.10 | Local model serving (optional) |
| git | ≥ 2.0 | Version control |

## Installation

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
npm install
```

## Configuration

Copy and edit the config file:

```bash
cp config.example.yaml config.yaml
```

### Providers

Configure at least one LLM provider in `config.yaml`:

```yaml
providers:
  openai:
    api_key: ${OPENAI_API_KEY}
    model: gpt-4o
  
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-20250514

  custom:
    base_url: http://localhost:8080
    model: local-model
    api_key: none
```

### Environment Variables

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or use `.env` file (git-ignored by default).

## Usage

### Interactive Mode

```bash
npm start
```

### Single Command

```bash
npm start -- "list files in current directory"
```

### With Specific Provider

```bash
npm start --provider anthropic "summarize this document"
```

## Project Structure

```
sns-myagent/
├── src/
│   ├── index.ts          # Entry point
│   ├── brain/            # LLM orchestration
│   ├── tools/            # Tool implementations
│   ├── skills/           # Skill loader
│   └── cli/              # Terminal UI
├── skills/               # Markdown skill files
│   ├── coding/
│   ├── web/
│   └── research/
├── config.example.yaml   # Config template
├── package.json
└── tsconfig.json
```

## Skills

Skills are markdown files that provide context for specific tasks. Load them by name:

```
/load coding
/load web-scraper
```

### Writing Skills

Create a `.md` file in `skills/` directory:

```markdown
---
name: my-skill
description: What this skill does
---

# Instructions

Agent follows these steps...
```

## Tools

Built-in tools:

| Tool | Description |
|------|-------------|
| `terminal` | Execute shell commands |
| `file_read` | Read file contents |
| `file_write` | Write/create files |
| `web_search` | Search the web |
| `browser` | Automate browser |

### Adding Custom Tools

1. Create file in `src/tools/`
2. Export function with tool schema
3. Register in `src/tools/index.ts`

## Memory

Mnemosyne memory layer stores facts across sessions.

### Commands

```
/recall <query>     # Search memories
/memory add <fact>  # Store new memory
/memory list        # List recent memories
```

### Memory Types

| Type | Scope | Use Case |
|------|-------|----------|
| Working | Session | Temporary context |
| Episodic | Persistent | Events, conversations |
| Semantic | Persistent | Facts, preferences |

## Troubleshooting

### API Key Errors

```
Error: Invalid API key
```

Verify environment variables are set:

```bash
echo $OPENAI_API_KEY
```

### Model Not Found

```
Error: Model gpt-4 not available
```

Check model name in `config.yaml`. Models are provider-specific.

### Permission Denied (Terminal Tool)

```
Error: Command not permitted
```

Add to `allowed_commands` in config:

```yaml
tools:
  terminal:
    allowed_commands:
      - ls
      - cat
      - git
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

## Project History

| Date | Event |
|------|-------|
| 2024 | Hermes Agent created by Nous Research |
| 2025-06-23 | Forked as SNS MyAgent |
| 2025-06-23 | Restructured for single-user CLI |

## License

MIT License. See [LICENSE](./LICENSE) for details.

Based on [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/).

## Author

**Reihan** — [GitHub](https://github.com/Reihantt6)
