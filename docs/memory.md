# Memory System

## Purpose

snsagent persists what it learns across sessions and re-injects relevant memories into a fresh turn's model context. There are seven backend IDs, resolved by `src/memory-backend/resolve.ts`: `mnemopi`, `hindsight`, `mnemosyne`, `mem0`, `lcm`, `local`, and `off`.

> **Important**: only `mnemopi` and `hindsight` are wired into automatic recall/injection. The other backends persist and recall manually but never feed memories back into the model context automatically.

## How it works

- The backend is selected by the `memory.backend` setting. The schema default is **`off`** (no memory subsystem), not `mnemopi`.
- `mnemopi` (the fully-integrated local backend) stores memories in SQLite under the agent directory and injects recalled facts into the first turn of a session via `agent-session.ts` (`beforeAgentStartPrompt` → `agent.setSystemPrompt`).
- `autoRetain` saves learned facts periodically; `autoRecall` re-injects them on a new session; `injectionTokenLimit` caps how much recalled memory goes into the payload.
- The full path - `user input → retain → persistent storage → new process → recall → context injection → model` - is proven by `src/memory-backend/__tests__/memory-integration.test.ts` (30 tests).

## Backends

| Backend | Storage | Auto-recall / auto-retain | Status |
|---------|---------|---------------------------|--------|
| `mnemopi` | local SQLite + embeddings + graph | Injected on first turn + auto-retain | VERIFIED |
| `hindsight` | remote service (`hindsight.apiUrl`, default `http://localhost:8888`) | Injected (when service configured) | PARTIAL |
| `local` | rollout-summary + `learned.md` lessons | Manual save only | PARTIAL |
| `mem0` | local SQLite + FTS5 semantic facts | Manual save/search only | PARTIAL |
| `lcm` | local SQLite, delta-encoded context | Manual save/search only | PARTIAL |
| `mnemosyne` | legacy three-tier SQLite | Manual | COMPAT ONLY |
| `off` | none | None | VERIFIED (no-op) |

Selecting `mnemosyne` is migrated to `mnemopi` at config load. It remains a selectable enum value only for compatibility.

## Configuration

```yaml
memory:
  backend: mnemopi            # off | mnemopi | hindsight | mem0 | lcm | local | mnemosyne
mnemopi:
  autoRecall: true
  autoRetain: true
  recallLimit: 8
  recallContextTurns: 3
  injectionTokenLimit: 5000   # budget for injected recalled memory
  retainEveryNTurns: 4
```

## Real example

```text
> remember that this project uses pnpm, not npm
> (new session, days later)
> which package manager should I use here?
  # agent recalls the stored fact and answers "pnpm" without re-reading the repo
```

## Expected behavior

- With `mnemopi`, retained facts survive process restarts and are semantically recalled (paraphrased queries still match).
- Recalled memory is injected on the first turn and truncated to fit `injectionTokenLimit`.
- With `off`, no memory is written or read.

## Failure behavior

- `hindsight` silently degrades to "no memory" if its service is not reachable.
- `mem0`/`lcm`/`local` persist but do **not** auto-inject - the agent will not "remember" across sessions unless the app code explicitly calls their save/search.

## Limitations

- Only `mnemopi` (and `hindsight`, when its service is up) feed the model context automatically. Manual backends are save/search-only.
- Memory is scoped per-project: the SQLite handle is keyed by resolved `agentDir`, so each project's memory stays isolated.

## Testing

```bash
bun test src/memory-backend/__tests__/memory-integration.test.ts
```

30 tests cover explicit retain, cross-process restart persistence, semantic recall, auto-retain, auto-recall injection, the injection-budget invariant, clear/delete, backend `off`, backend switching, and scope isolation - across all backends.
