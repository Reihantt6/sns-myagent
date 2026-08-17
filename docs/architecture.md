# Architecture

## Purpose

A map of how a user turn flows through snsagent and where the cross-cutting
subsystems (memory, TBM, advisor, tools) hook in. This is the runtime call path the
deep audit traced — not just a directory listing.

## High-level flow

```
CLI (src/cli/entry.ts)
  → createAgentSession (src/sdk.ts)
      builds TbmManager from settings (tbm.* → resolveTbmConfigFromSettings)
      builds transformContext = composeTransformContext({ tbm, emitContext, wrapSteering })
  → AgentSession (src/session/agent-session.ts)
      owns the pi-agent-core Agent, tools, memory, advisor, compaction
  → Agent.prompt (turn loop, @oh-my-pi/pi-agent-core)
      pre-model  → transformContext → applyTbmPreModel
      model call → streamFn / convertToLlm
      post-tool  → Agent.afterToolCall → applyTbmToolCompression
      post-turn  → Agent.setOnTurnEnd → cacheTbmTurnResponse + advisor onTurnEnd
```

## The agent session (src/session/agent-session.ts)

The single coordination point. It wires the upstream `@oh-my-pi/pi-agent-core` loop to
snsagent's subsystems:

| Hook | Subsystem | Where |
|---|---|---|
| `transformContext` | TBM pre-model (comm-mode, tombstone, delta, pyramid, lazy-skills) | `src/tbm/session-hooks.ts` → `composeTransformContext` |
| `afterToolCall` | TBM tool-output compression (+ TTSR reminders) | `agent-session.ts` `#afterToolCall` |
| `setOnTurnEnd` | TBM response-cache store + advisor turn review | `agent-session.ts` turn-end callback |
| `beforeAgentStartPrompt` | memory auto-recall injection | `agent-session.ts` → `agent.setSystemPrompt` |

All TBM hooks are pure functions of `(TbmManager, messages)` in
`src/tbm/session-hooks.ts`, so they are testable with real `AgentMessage` shapes.

## Key subsystems

| Subsystem | Path | Notes |
|---|---|---|
| Settings | `src/config/settings.ts`, `settings-schema.ts` | dot-separated paths, YAML/JSON |
| Tools | `src/tools/` | 30 built-in names in `builtin-names.ts` |
| Memory | `src/memory-backend/` + `src/mnemopi/` + `src/hindsight/` | resolver → backend; mnemopi injects |
| TBM | `src/tbm/` | integrated, default OFF |
| Slash commands | `src/slash-commands/builtin-registry.ts` | 62 commands + aliases |
| TUI | `src/modes/`, `src/tui/`, `src/ui/` | interactive mode |
| Telegram | `src/adapters/telegram/` | grammY bot; auth via allowlist |
| Subagents / multi-agent | `src/task/`, `src/agents/` | delegation + ensemble strategies |
| Eval | `src/eval/` | Python/JS/Ruby/Julia runtimes |
| MCP | `src/mcp/` | Model Context Protocol servers |
| Cron | `src/cron/` | SQLite-backed scheduler |
| Extensibility | `src/extensibility/` | skills + plugins + marketplace |
| Collab | `src/collab/` | host/join sessions |

## Token counting

TBM's `estimateTokens` (`src/tbm/context-delta.ts`) delegates to
`@oh-my-pi/pi-agent-core` `countTokens`, the same estimator the session uses for
compaction. There is no divergent chars/4 heuristic in the integrated path.

## Testing status

```bash
bun test src            # core unit + integration suites
bun test test/          # committed integration tests
bun scripts/tbm-benchmark.ts   # TBM harness benchmark (not end-to-end)
```

The turn-lifecycle wiring is covered by `src/tbm/__tests__/tbm-agent-loop.test.ts`
(real pi-agent-core loop) and `tbm-session-integration.test.ts` (hook-level effects).
Memory's full path is covered by `src/memory-backend/__tests__/memory-integration.test.ts`.
