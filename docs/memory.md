# Memory System

## Purpose

snsagent can persist what it learns across sessions and re-inject relevant memories
into a fresh turn's model context. There are seven backend IDs, resolved by
`src/memory-backend/resolve.ts`: `mnemopi`, `hindsight`, `mnemosyne`, `mem0`, `lcm`,
`local`, and `off`.

> **Important**: only `mnemopi` and `hindsight` are wired into automatic
> recall/injection. The other backends persist and recall manually but never feed
> memories back into the model context automatically.

## How it works

- The backend is selected by the `memory.backend` setting. The schema default is
  **`off`** (no memory subsystem), not `mnemopi`.
- `mnemopi` (the fully-integrated local backend) stores memories in SQLite under the
  agent directory and injects recalled facts into the first turn of a session via
  `agent-session.ts` (`beforeAgentStartPrompt` → `agent.setSystemPrompt`).
- `autoRetain` saves learned facts periodically; `autoRecall` re-injects them on a new
  session; `injectionTokenLimit` caps how much recalled memory goes into the payload.
- The full path — `user input → retain → persistent storage → new process → recall →
  context injection → model` — is proven by
  `src/memory-backend/__tests__/memory-integration.test.ts` (30 tests).

## Backends

| Backend | Storage | Auto-recall / auto-retain | Status |
|---------|---------|---------------------------|--------|
| `mnemopi` | local SQLite + embeddings + graph | ✅ injected on first turn + auto-retain | VERIFIED |
| `hindsight` | remote service (`hindsight.apiUrl`, default `http://localhost:8888`) | ✅ injected (when service configured) | PARTIAL |
| `local` | rollout-summary + `learned.md` lessons | ❌ manual save only | PARTIAL |
| `mem0` | local SQLite + FTS5 semantic facts | ❌ manual save/search only | PARTIAL |
| `lcm` | local SQLite, delta-encoded context | ❌ manual save/search only | PARTIAL |
| `mnemosyne` | legacy three-tier SQLite | — | BROKEN (dead code) |
| `off` | none | ❌ | VERIFIED (no-op) |

`mnemosyne` is **dead code**: selecting it is migrated to `mnemopi` at config load, so
the backend is unreachable. It remains a selectable enum value only for compatibility.

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

- With `mnemopi`, retained facts survive process restarts and are semantically
  recalled (paraphrased queries still match).
- Recalled memory is injected on the first turn and truncated to fit
  `injectionTokenLimit`.
- With `off`, no memory is written or read (verified: no silent writes).

## Failure behavior

- `hindsight` silently degrades to "no memory" if its service is not reachable.
- `mem0`/`lcm`/`local` persist but do **not** auto-inject — the agent will not
  "remember" across sessions unless the app code explicitly calls their save/search.
- `mnemosyne` never runs; its selection is redirected to `mnemopi`.

## Limitations

- Only `mnemopi` (and `hindsight`, when its service is up) feed the model context
  automatically. Manual backends are save/search-only.
- Per-project scope isolation is implemented for the SQLite backends (the DB handle is
  keyed by resolved `agentDir`); this was a fixed cross-project leak, not a design goal.

## Testing status

```bash
bun test src/memory-backend/__tests__/memory-integration.test.ts
```

30 tests cover explicit retain, cross-process restart persistence, semantic recall,
auto-retain, auto-recall injection, the injection-budget invariant, clear/delete,
backend `off`, backend switching, and scope isolation — across all backends.
