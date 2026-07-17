# Memory System

SNS MyAgent supports 7 memory backends (mnemopi, hindsight, mnemosyne, mem0, lcm, local, off), switchable through conversation. Source: `src/memory-backend/resolve.ts`.

---

## mnemopi (Default)

Built-in memory backend with SQLite + vector embeddings + graph. Zero setup, no external services.

### Architecture
```
┌─────────────────────────────────────┐
│           MNEMOPI                   │
├─────────────────────────────────────┤
│  Working Memory   │ Session-scoped  │
│  Episodic Memory  │ Cross-session   │
│  Semantic Memory  │ Persistent      │
│  Knowledge Graph  │ Relationships   │
│  Vector Search    │ Embeddings      │
└─────────────────────────────────────┘
```

### Tiers

| Tier | Scope | Lifetime | Use Case |
|------|-------|----------|----------|
| **Working** | Current session | Session ends | Active task state, temp context |
| **Episodic** | Cross-session | Persistent | Conversation history, past events |
| **Semantic** | Cross-session | Persistent | Facts, preferences, patterns |

### Commands
```
/recall <query>              # Semantic + full-text search
/memory add <fact>           # Store semantic memory
/memory list                 # List recent
/memory list --tier episodic # Filter by tier
/memory clear                # Clear working memory
/memory forget <id>          # Remove specific
```

---

## Mem0

Semantic memory with vector embeddings + fact extraction.

### Deployment Modes

| Mode | Requirements | Cost |
|------|-------------|------|
| **Cloud** (app.mem0.ai) | Account + API key | Free (10K) → $19-249/mo |
| **Self-hosted** (Docker) | Docker, PostgreSQL+pgvector | Free (Apache 2.0) |
| **Library** (`pip install mem0ai`) | Python, vector DB | Free |
| **Local** (Ollama) | Ollama + ChromaDB | Fully local |

### Self-host Setup
```bash
git clone https://github.com/mem0ai/mem0
cd mem0/server
docker compose up -d
make bootstrap  # creates admin + API key
```

### Capabilities
- Semantic search across all memories
- Fact extraction from conversations
- Entity linking
- Temporal reasoning
- 24+ vector store backends
- Graph memory (Neo4j — Pro+ cloud, or free self-hosted)

### Limitations
- Memory staleness after 30 days (~49% accuracy at scale)
- LLM dependency on every `add()` call
- Graph memory = $249/mo on cloud (free self-hosted)

---

## LCM (Latent Context Memory)

Compressed context representation for long-running sessions.

### When to use
- Very long sessions (100+ turns)
- Context window is a constraint
- Don't need precise memory recall

---

## Switching Backends

### Through conversation
```
> switch memory to Mem0
> switch memory to mnemopi
```

### Through config
```yaml
memory:
  backend: mnemopi  # mnemopi | hindsight | mnemosyne | mem0 | lcm | local | off
```

---

## Data Location

| Data | Path |
|------|------|
| Config | `./config.yaml` |
| Memory DB | `~/.sns-myagent/memory.db` |
| Logs | `~/.sns-myagent/logs/` |

No data sent to external servers except LLM API calls to your configured provider.
