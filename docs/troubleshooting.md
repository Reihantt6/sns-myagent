# Troubleshooting

## API Key Errors

```
Error: Invalid API key for provider 'openai'
```

Fix:
```bash
echo $OPENAI_API_KEY
```

Or tell the agent: *"reconfigure openai, my API key is <your-openai-key>"*

---

## Model Not Found

```
Error: Model 'gpt-4' not available for provider 'openai'
```

Fix: check exact model name in `config.yaml`:
- OpenAI: `gpt-4o`, `gpt-4-turbo`
- Anthropic: `claude-sonnet-4-20250514`

Or: *"switch to gpt-4o"*

---

## Permission Denied (Terminal Tool)

```
Error: Command 'rm' not permitted
```

Fix: add to `tools.terminal.allowed_commands` in config, or tell agent: *"allow rm command"*

---

## Connection Refused (Local Model)

```
Error: connect ECONNREFUSED 127.0.0.1:11434
```

Fix:
```bash
ollama serve
curl http://localhost:11434/api/tags
```

Or: *"restart ollama"*

---

## Memory Database Locked

```
Error: SQLITE_BUSY: database is locked
```

Fix: another instance running:
```bash
pkill -f snsagent
rm ~/.sns-myagent/memory.db-wal ~/.sns-myagent/memory.db-shm
```

---

## bun install fails

```bash
# Clear cache
bun pm cache rm
rm -rf node_modules bun.lockb
bun install
```

---

## Permission errors on global install

```bash
# Option 1: fix Bun permissions (recommended)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Option 2: install to a writable prefix
bun add -g --trust snsagent
```

---

## Port conflicts (MCP servers)

```bash
# Check what's using the port
lsof -i :3000
# Kill it
kill -9 <PID>
```

---

## Still stuck?

1. Check GitHub Issues: https://github.com/Reihantt6/sns-myagent/issues
2. Open new issue with: error message, OS, Bun version, steps to reproduce
