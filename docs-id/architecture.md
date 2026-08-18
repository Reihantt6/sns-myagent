# Arsitektur

## Tujuan

Peta tentang bagaimana turn pengguna mengalir melalui snsagent dan di mana subsistem lintas-urusan (memory, TBM, advisor, tools) terhubung.

## Alur tingkat tinggi

```
CLI (src/cli/entry.ts)
  → createAgentSession (src/sdk.ts)
      membangun TbmManager dari settings (tbm.* → resolveTbmConfigFromSettings)
      membangun transformContext = composeTransformContext({ tbm, emitContext, wrapSteering })
  → AgentSession (src/session/agent-session.ts)
      memiliki pi-agent-core Agent, tools, memory, advisor, compaction
  → Agent.prompt (turn loop, @oh-my-pi/pi-agent-core)
      pre-model  → transformContext → applyTbmPreModel
      model call → streamFn / convertToLlm
      post-tool  → Agent.afterToolCall → applyTbmToolCompression
      post-turn  → Agent.setOnTurnEnd → cacheTbmTurnResponse + advisor onTurnEnd
```

## Agent session (src/session/agent-session.ts)

Titik koordinasi tunggal. Ia menghubungkan loop upstream `@oh-my-pi/pi-agent-core` ke subsistem snsagent:

| Hook | Subsistem | Lokasi |
|---|---|---|
| `transformContext` | TBM pre-model (comm-mode, tombstone, delta, pyramid, lazy-skills) | `src/tbm/session-hooks.ts` → `composeTransformContext` |
| `afterToolCall` | Kompresi output tool TBM (+ pengingat TTSR) | `agent-session.ts` `#afterToolCall` |
| `setOnTurnEnd` | Store response-cache TBM + review turn advisor | `agent-session.ts` callback akhir turn |
| `beforeAgentStartPrompt` | Injeksi auto-recall memory | `agent-session.ts` → `agent.setSystemPrompt` |

Semua hook TBM adalah fungsi murni dari `(TbmManager, messages)` di `src/tbm/session-hooks.ts`, jadi mereka dapat diuji dengan bentuk `AgentMessage` yang nyata.

## Subsistem utama

| Subsistem | Path | Catatan |
|---|---|---|
| Settings | `src/config/settings.ts`, `settings-schema.ts` | Path dipisah titik, YAML/JSON |
| Tools | `src/tools/` | 30 nama built-in di `builtin-names.ts` |
| Memory | `src/memory-backend/` + `src/mnemopi/` + `src/hindsight/` | resolver → backend; mnemopi menyuntikkan |
| TBM | `src/tbm/` | terintegrasi, default OFF |
| Slash commands | `src/slash-commands/builtin-registry.ts` | 62 perintah + alias |
| TUI | `src/modes/`, `src/tui/`, `src/ui/` | mode interaktif |
| Telegram | `src/adapters/telegram/` | bot grammY; auth via allowlist |
| Subagents / multi-agent | `src/task/`, `src/agents/` | delegasi + strategi ensemble |
| Eval | `src/eval/` | runtime Python/JS/Ruby/Julia |
| MCP | `src/mcp/` | server Model Context Protocol |
| Cron | `src/cron/` | scheduler berbasis SQLite |
| Extensibility | `src/extensibility/` | skills + plugins + marketplace |
| Collab | `src/collab/` | sesi host/join |

## Penghitungan token

`estimateTokens` milik TBM (`src/tbm/context-delta.ts`) mendelegasikan ke `countTokens` dari `@oh-my-pi/pi-agent-core`, estimator yang sama yang dipakai sesi untuk compaction.

## Pengujian

```bash
bun test src            # unit inti + suite integrasi
bun test test/          # test integrasi yang di-commit
bun scripts/tbm-benchmark.ts   # benchmark harness TBM (bukan end-to-end)
```

Wiring turn-lifecycle dicakup oleh `src/tbm/__tests__/tbm-agent-loop.test.ts` dan `tbm-session-integration.test.ts` (efek tingkat hook). Jalur penuh memory dicakup oleh `src/memory-backend/__tests__/memory-integration.test.ts`.
