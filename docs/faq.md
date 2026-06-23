# Frequently Asked Questions

## General

### How is this different from Hermes Agent?

Hermes Agent is a multi-platform, multi-user agent framework with 20+ messaging integrations, desktop app, voice mode, and 6 deployment backends. SNS MyAgent strips all that. Single user, terminal only, with conversational configuration — the agent manages its own setup. Plus Token Budget Manager.

### How is this different from other agent CLIs?

Most agent CLIs (Pi, omp) require manual configuration. SNS MyAgent configures itself through conversation — same as Hermes Agent (its upstream), but purpose-built for single-user terminal use.

### Can I use it without API keys (fully local)?

Yes. Tell the agent: *"setup ollama with llama3"*. It installs Ollama, pulls the model, configures the provider. Or manually set `custom` provider with `api_key: none`.

---

## Installation

### What are the minimum specs?

- RAM: 2 GB free (4 GB+ recommended)
- Disk: 500 MB (2 GB+ recommended)
- CPU: Any modern CPU
- OS: Linux, macOS, Windows (WSL2)

### Do I need to install Node.js?

If using `curl | bash` install script, it installs Node.js via nvm automatically. Otherwise, yes — Node.js >= 20.0 required.

### Can I run it on Windows?

Yes, via WSL2 (recommended) or natively with PowerShell.

---

## Usage

### Where is my data stored?

| Data | Path |
|------|------|
| Config | `./config.yaml` |
| Memory | `~/.sns-myagent/memory.db` |
| Logs | `~/.sns-myagent/logs/` |

No data sent to external servers except LLM API calls.

### Can I add my own skills?

Yes. Create `.md` files in `skills/`. See [Skills](../README.md#skills).

### How do I switch providers mid-session?

`/provider <name>` or say *"switch to anthropic"*.

### Can I use multiple providers simultaneously?

One active at a time. Switch per-command (`--provider`) or mid-session.

### Does it support streaming responses?

Yes. Enabled by default (`ui.streaming: true`).

### Which memory backend should I use?

- **Mnemosyne** (default): best general-purpose. Three tiers, full-text search.
- **Mem0**: better for preference/fact extraction from conversations.
- **LCM**: better for long sessions where context window is a constraint.

Switch any time: *"switch memory to Mem0"*.

### What is Token Budget Manager?

TBM is SNS MyAgent's built-in token efficiency system. It caches static context, compresses tool output, loads skills on-demand, and provides 3 communication modes. Saves 70-90% input tokens in long sessions. No other agent has this. See [TBM docs](tbm.md).

---

## Memory

### Can I backup my memories?

```bash
cp ~/.sns-myagent/memory.db ~/backup/memory-$(date +%Y%m%d).db
```

### Can I export memories?

Coming soon. For now, copy the SQLite database directly.

### How much storage does memory use?

Typically 10-100 MB for personal use (thousands of memories).

---

## Security

### Is my data sent anywhere?

No, except LLM API calls to your configured provider. All memory, config, and logs are local.

### Are API keys safe?

Keys stored in environment variables or `config.yaml`. Never committed to git (`.gitignore` enforced). Passed to providers over HTTPS only.

### Can someone access my agent?

Only if they have access to your machine. No remote access, no server, no auth layer needed (single-user by design).
