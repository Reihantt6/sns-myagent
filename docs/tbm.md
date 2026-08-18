# Token Budget Manager (TBM)

## Overview

The Token Budget Manager (`src/tbm/`) manages context usage inside the agent turn lifecycle. It is integrated into the main agent loop: `createAgentSession` (`src/sdk.ts`) builds a `TbmManager` from settings and passes it to both the agent's `transformContext` (pre-model) and `AgentSession` (`session.tbm`, post-tool / post-turn).

## Turn lifecycle wiring

| Phase | Subsystem | Hook |
|---|---|---|
| pre-model | comm-mode directive | `transformContext` → `applyTbmPreModel` |
| pre-model | tombstone (old plain-text messages) | `transformContext` → `applyTbmPreModel` |
| pre-model | context-delta accounting | `transformContext` → `applyTbmPreModel` |
| pre-model | pyramid level | `transformContext` → `applyTbmPreModel` |
| pre-model | lazy skills | `transformContext` → `applyTbmPreModel` |
| post-tool | tool-output compression | `Agent.afterToolCall` → `applyTbmToolCompression` |
| post-turn | response-cache store | `Agent.setOnTurnEnd` → `cacheTbmTurnResponse` |

All hooks live in `src/tbm/session-hooks.ts` as pure functions of `(TbmManager, messages)` so they can be driven with real `AgentMessage` shapes in tests.

## Configuration

`tbm.*` keys are declared in `src/config/settings-schema.ts` and bridged to `TbmConfig` by `src/tbm/settings-bridge.ts` (`resolveTbmConfigFromSettings`). Set a `tbm:` block in config.yml:

```yaml
tbm:
  enabled: true
  commMode: caveman
  compressTerminal: 500
```

The master switch **defaults to OFF**, so the existing loop is byte-for-byte unchanged until you opt in. When disabled, every hook is a pass-through.

## Token counting

`src/tbm/context-delta.ts` `estimateTokens` delegates to `@oh-my-pi/pi-agent-core` `countTokens` - the same byte-based estimator the session uses for compaction.

## What TBM does not do

- **Response cache is store-only.** `cacheTbmTurnResponse` records the (query → response) pair, but a cache hit does not short-circuit the model call - the structured loop cannot safely skip a turn here yet.
- **Context delta is accounting-only.** `processTurn` hashes a static/dynamic split and reports saved tokens, but it never drops the static prefix from the wire. The provider prompt cache already handles real prefix caching; TBM only measures it.
- **Tombstone only touches plain-text `user`/`assistant` messages.** Messages with tool calls, images, or thinking blocks are skipped so tool-call ↔ tool-result pairing survives.

## Harness benchmark

`bun scripts/tbm-benchmark.ts` drives `TbmManager` directly on a deterministic 20-turn synthetic conversation (no network/model). Output tokens and real model latency are therefore not measured here.

| Metric | TBM OFF | TBM ON |
|---|---:|---:|
| input (content) tokens | 28,510 | 1,836 |
| directive tokens | 0 | 890 |
| total tokens (input + directive) | 28,510 | 2,726 |
| simulated model calls (turns) | 20 | 20 |
| context-delta cache hits | 0/20 | 19/20 |
| tool outputs compressed | 0/20 | 20/20 |
| response cache hits | 0/20 | 10/20 |
| messages tombstoned | 0 | 700 |
| latency (subsystem calls only) | ~1 ms | ~8 ms |

Measured harness reduction: **93.6% fewer on-wire content tokens** in this synthetic harness, dominated by the context-delta cache dropping a mostly-static prefix. This is a harness measurement, not a claim about real sessions.

## Testing

```bash
bun test src/tbm/__tests__/tbm.test.ts
bun test src/tbm/__tests__/tbm-audit.test.ts
bun test src/tbm/__tests__/tbm-session-integration.test.ts   # real-turn hooks (12 tests)
bun test src/tbm/__tests__/tbm-agent-loop.test.ts            # real pi-agent-core loop (4 tests, regression-proof)
bun scripts/tbm-benchmark.ts
```

`tbm-session-integration.test.ts` asserts observable payload effects on a real turn: the comm-mode directive is injected, old messages are replaced by tombstones (originals do not re-enter verbatim, tool-call messages are skipped), oversized tool output is truncated, and the finished turn's query/response pair lands in the response cache. It also proves `tbm.*` config is consumed and the schema default is OFF.

`tbm-agent-loop.test.ts` drives the real pi-agent-core `Agent.prompt` loop through `composeTransformContext` (the exact seam `createAgentSession` uses) and asserts the TBM effects are observable in the assembled model-request payload. Lazy-skills injection is also covered here - the pre-model hook injects the name index plus the full content of only the referenced skills.
