# Memory System

snsagent supports seven memory backend IDs: `mnemopi`, `hindsight`, `mnemosyne`, `mem0`, `lcm`, `local`, and `off`. The resolver is `src/memory-backend/resolve.ts`.

Select the backend with the `memory.backend` setting in `~/.omp/agent/config.yml`, or use `/settings` and `/memory` in the interactive agent.

## mnemopi

mnemopi is the default local backend. It stores memory in SQLite under the agent directory, normally below `~/.omp/agent/memories/mnemopi/` or a scoped bank directory. The backend supports local memory retrieval, embeddings, and graph-related memory features.

Relevant settings include:

```yaml
memory:
  backend: mnemopi
mnemopi:
  autoRecall: true
  autoRetain: true
  recallLimit: 8
  recallContextTurns: 3
  injectionTokenLimit: 5000
```

Use these interactive commands where supported:

```text
/memory view
/memory stats
/memory diagnose
/memory clear
/memory enqueue
```

## local

The local backend provides a local rollout summary pipeline without a remote memory service.

## off

The off backend disables memory operations.

## hindsight

Hindsight is a remote memory backend. It requires the endpoint and credentials expected by the Hindsight integration.

## mnemosyne

The mnemosyne backend is available through the resolver for compatibility and specialized local deployments. Check its runtime requirements before selecting it.

## mem0

The mem0 backend integrates with Mem0-compatible services. Configure the service endpoint and credentials required by your deployment.

## lcm

The LCM backend provides a compressed context representation for long-running sessions. Configure its service requirements before selecting it.

## Switching backends

Edit `~/.omp/agent/config.yml`:

```yaml
memory:
  backend: mnemopi
```

Or open `/settings` and change the memory backend. Confirm the selected backend with `/memory stats`.

## Data and backups

| Data | Location |
|------|----------|
| Interactive settings | `~/.omp/agent/config.yml` |
| Provider models | `~/.omp/agent/models.yml` |
| Agent database | `~/.omp/agent/agent.db` |
| mnemopi data | `~/.omp/agent/memories/` and scoped bank directories |

Stop snsagent before copying SQLite files so the database and any journal files are consistent. Do not edit `agent.db` directly.