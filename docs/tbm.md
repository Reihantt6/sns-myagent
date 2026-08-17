# Token Budget Manager (TBM)

## Status: NOT integrated into the main agent loop

`src/tbm/` contains a complete, self-contained `TbmManager` with nine subsystems and
unit tests. **It is not wired into the main agent loop.** This was verified by
call-graph audit, not assumed from docs:

- No `new TbmManager(...)` exists anywhere outside `src/tbm/` and its test/benchmark
  harness. Grep across `src/`, `test/`, and `scripts/` returns zero construction sites.
- The `/tbm` and `/tbm mode` slash commands read `session.tbm`, but **nothing ever
  assigns `session.tbm`**, so at runtime those commands always report
  `TBM not initialized. Check config tbm.enabled.`
- There is **no `tbm.*` key in `src/config/settings-schema.ts`**. The `TbmConfig`
  type in `src/tbm/config.ts` (and its "loaded from `.sns-myagent/config.yaml`
  under the `tbm:` key" comment) is not backed by any schema entry, so a `tbm:`
  block in the persisted settings file is never parsed or consumed.
- `resolveTbmConfig()` / `DEFAULT_TBM_CONFIG` have zero callers outside `src/tbm/`.

Per-subsystem callers (all outside `src/tbm/` = none):

| Subsystem | External callers | Runs on a real agent turn? |
|---|---|---|
| `comm-modes.ts` (`CommunicationModeManager`) | none | no |
| `context-delta.ts` (`ContextDeltaCache`) | none | no |
| `context-pyramid.ts` (`ContextPyramid`) | none | no |
| `lazy-skills.ts` (`LazySkillLoader`) | none | no |
| `response-cache.ts` (`ResponseCache`) | none | no |
| `tombstone.ts` (`ConversationTombstoner`) | none | no |
| `tool-compress.ts` (`ToolOutputCompressor`) | none | no |
| `dashboard.ts` (`buildDashboard`/render) | none (slash command is un-wired) | no |
| `config.ts` (`resolveTbmConfig`) | none | no |

> `estimateTokens` is also exported from `src/tbm/context-delta.ts`, but the
> `estimateTokens` used in `src/session/agent-session.ts` is imported from
> `@oh-my-pi/pi-agent-core`, not from TBM.

### Runtime diagram (actual call paths, not design intent)

```text
User Turn
  ↓
Agent Loop (src/session/agent-session.ts, src/sdk.ts)
  ↓
TbmManager?          ← NOT WIRED (no construction site)
  ├─ context delta        ✗
  ├─ context pyramid      ✗
  ├─ lazy skills          ✗
  ├─ tool compression     ✗
  ├─ response cache       ✗
  ├─ tombstone            ✗
  └─ communication mode   ✗
  ↓
model request (unaffected by any TBM subsystem)
```

The `/tbm` slash command is the only user-facing surface and it is inert.

## What TBM does provide today

`TbmManager` exposes a coherent API for processing a turn, compressing tool output,
caching responses, tombstoning messages, registering skills, switching communication
mode, and rendering the token dashboard. It is unit-tested
(`src/tbm/__tests__/tbm.test.ts` and `src/tbm/__tests__/tbm-audit.test.ts`) and can be
exercised through the standalone harness `scripts/tbm-benchmark.ts`.

## Token budgets that ARE separately integrated

The main tree has its own, independent token-budget controls (not `TbmManager`):

- Goal token budgets — `src/goals/runtime.ts`.
- Soft subagent request budgets — `src/task/executor.ts`.
- The `+Nk`/`+Nm` turn-budget directive — `src/modes/turn-budget.ts`, surfaced to the
  eval `budget` helper via `src/tools/index.ts` `getTurnBudget`.

Do not conflate these with the `TbmManager` class.

## Measured harness benchmark (not end-to-end)

`bun scripts/tbm-benchmark.ts` drives `TbmManager` directly on a synthetic 20-turn
conversation. This measures the subsystem in isolation, **not** an agent session.

| Metric | TBM OFF | TBM ON |
|---|---:|---:|
| content tokens sent | 28,510 | 1,836 |
| directive tokens | 0 | 890 |
| context-delta cache hits | 0/20 | 19/20 |
| tool outputs compressed | 0/20 | 20/20 |
| response cache hits | 0/20 | 10/20 |
| messages tombstoned | 0 | 700 |
| latency (subsystem calls only) | 1.6 ms | 9.4 ms |

Measured harness reduction: **93.6% fewer on-wire content tokens** in this specific
synthetic harness. This number is **not** a claim about real sessions — it is dominated
by the context-delta cache dropping a mostly-static synthetic prefix. Real-session
savings can only be claimed after TBM is actually wired into the agent loop and
benchmarked end-to-end.

## Testing

```bash
bun test src/tbm/__tests__/tbm.test.ts
bun test src/tbm/__tests__/tbm-audit.test.ts
bun scripts/tbm-benchmark.ts
```

## Configuration note

`src/tbm/config.ts` defines `TbmConfig` with `DEFAULT_TBM_CONFIG` (everything enabled).
This object is **not** wired into the settings schema or the settings loader. Setting a
`tbm:` block in `.sns-myagent/config.yaml` has no runtime effect today. If TBM is ever
integrated, the config must first be added to `src/config/settings-schema.ts` and consumed
through `Settings.get(...)` like every other subsystem.
