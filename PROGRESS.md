# SNS-MyAgent — Project Progress

> Auto-maintained. Last updated: 2026-06-30 00:55 UTC

## TL;DR Next Session

> **JANGAN baca ulang seluruh projek.** Cek section ini dulu.

### 🔥 Yang BELUM selesai (aktif)

| # | Task | File/Module | Effort | Block |
|---|------|-------------|--------|-------|
| 5.1d | **CLI `orchestrate` agent executor** (wire real LLM call) | `src/agents/executor.ts` (NEW) | ~4h | — |
| 11 | **Session DAG** (fork/merge) | ~1 day | — |
| 13 | **npm publish** (`@sns-myagent/cli`) | ~2h | — |
| 14 | **macOS + Windows binaries** (CI matrix) | ~1 day | 13 |
| 15 | **Docker image** (`ghcr.io/reihantt6/sns-myagent`) | ~2h | — |
| 16 | **E2E smoke tests** (all platforms) | ~3h | 13-15 |

### 📋 Yang Planned (belum mulai)

_(nothing — moved to active)_

### ✅ DONE (jangan kerjain ulang)

| Phase | Item | Commit | Date |
|-------|------|--------|------|
| 0 | PRD v2 + README + docs + planning | — | 2026-06-23 |
| 1 | Fork Pi Agent + rebrand + CLI + config + CI/CD | `d1480eb` | 2026-06-24 |
| 1.5 | v0.1.0 binary + GitHub Release (3 assets) | `c156e8c` | 2026-06-25 |
| 2 | Telegram bot + handler + format + tests | — | 2026-06-25 |
| 2.5 | ARM64 cross-compile + multi-arch install.sh | — | 2026-06-25 |
| 2.8 | TBM 11 modules (`src/tbm/`, 2711 lines) + `/tokens` `/mode` | — | 2026-06-25 |
| 3 | README audit + binary verify + launch command + .gitignore cleanup | `92110c4` | 2026-06-26 |
| 4 | **Telegram bridge + slash commands + file upload/download + binary v0.2.0** | `b89123c` `9208c21` `2756988` | 2026-06-26 |
| 5.3 | Async workflow engine — task-store + runner + notifier + /task | `4a9a819` | 2026-06-27 |
| 5 | **Multi-agent orchestration**: agents.yaml + 3 ensemble strategies + resilience + 21 tests + CLI `orchestrate` + v0.3.0 binary | `c2a2a0d` `a0d4393` `17be410` `519684a` `e3e9782` | 2026-06-30 |

---

## Repo State (2026-06-30)

```
Branch:      main @ e3e9782
Last commit: feat(phase-5): multi-agent orchestration + working v0.3.0 binary
TS:          clean (tsc -p tsconfig.json --noEmit → 0 errors)
Tests:       21 agents tests pass (strategies 6 + resilience 9 + config 6) + 21 async tests = 42/42 in scope
Binary:      bin/snscoder-linux-x64 0.3.0 (117MB ELF, JS-only mode — pi-natives version mismatch, CLI works)
Default LLM: openai/gpt-4o-mini
```

### Uncommitted (local only)
```
(clean — all committed in e3e9782)
```

### Source Inventory (verified)
| Module | Location | Files | Status |
|--------|----------|-------|--------|
| TBM | `src/tbm/` | 11 | ✅ Compiled |
| Memory Backends | `src/memory-backend/` | 9 | ⚡ Exists, unwired (future) |
| Cron | `src/cron/` | 6 | ⚡ Exists, unwired (future) |
| Async Workflow | `src/async/` | 7 | ✅ task-store + runner + notifier + 21 tests |
| Telegram | `src/adapters/telegram/` | 5 | ✅ Bridge + slash cmds + file upload/download |
| CLI | `src/cli/` | 51 | ✅ Done + `orchestrate` command |
| Commands | `src/commands/` | 32 | ✅ Done |
| **Agents (Phase 5)** | `src/agents/` | 7 + 3 test files | ✅ config + ensemble + 3 strategies + resilience + 21 tests |
| UI/TUI | `src/ui/` (9) + `src/tui/` (14) | 23 | ✅ Branded premium (gradient, bubbles, palette, toast, code-cell, error-display) |

**Total**: 1,013 .ts files (outer src/) + 999 nested fork copy.

---

## Per-Phase Plan Files

| File | Scope |
|------|-------|
| `PLAN-PHASE-4.md` | Wire memory + cron + TG slash cmds + file handling |
| `PLAN-PHASE-5.md` | Multi-agent + roles + parallel + ensemble + DAG |
| `PLAN-PHASE-6.md` | npm publish + multi-OS binaries + Docker + E2E |
| `PLAN-OMP-CUSTOMIZATION.md` | OMP terminal integration (8 phases) |
| `PLAN-TERMINAL-UI.md` | **NEW** — Full terminal UI redesign |

---

## Run Status

| Method | Works? | Command |
|--------|--------|---------|
| Source (Bun) | ✅ YES | `bun run src/cli/entry.ts --version` |
| Binary (x64) | ✅ YES | `bin/snscoder --version` (JS-only fallback, no natives) |
| Binary (ARM64) | ❌ NO | Same pi_natives issue, untested |
| CLI shim | ⚠️ | `node bin/snscoder.js` |

**Root cause natives**: `@oh-my-pi/pi-natives` napi-rs addon can't be bundled by `bun build --compile`. Workaround = source mode or JS-only fallback.

---

## Decision Log

| # | Decision | Date |
|---|----------|------|
| 1 | Fork Pi Agent | 2026-06-24 |
| 2 | Bun runtime (not Node) | 2026-06-24 |
| 3 | Biome linter | 2026-06-24 |
| 4 | mnemopi memory backend | 2026-06-24 |
| 5 | Telegram polling first | 2026-06-24 |
| 6 | MVP = CLI + TG + Memory | 2026-06-24 |
| 7 | Multi-agent in scope | 2026-06-24 |
| 8 | ARM64 cross-compile | 2026-06-25 |
| 9 | install.sh = download prebuilt | 2026-06-25 |
| 10 | Per-phase plan files | 2026-06-25 |
| 11 | **Terminal UI redesign — premium branded, bukan generic CLI** | 2026-06-26 |
| 12 | **Multi-agent orchestrator wraps existing Pi infra (don't rebuild)** | 2026-06-27 |
| 13 | **JS-only fallback acceptable for binary mode** (pi-natives can't bundle, napi-rs limitation) | 2026-06-30 |

---

## v0.2.0 Scope — COMPLETED ✅

**Features delivered**:
- [x] Telegram bridge (forwardToAgent + session cache)
- [x] Telegram slash commands (/memory /cron /model /code /review /tokens /mode)
- [x] File upload/download via Telegram (document/photo/video/voice/audio)
- [x] Binary rebuilt v0.2.0 (113MB, `snscoder 0.2.0`)

**Quality gate**:
- [x] TS clean
- [x] Binary works on Linux x64
- [ ] E2E smoke test (pending — need live Telegram token)

**Tag**: `v0.2.0` after docs committed

---

## Next: v0.3.0 Target Scope

**Phase 5**: Multi-agent orchestrator + roles + parallel + ensemble
**Phase 6**: npm publish + multi-OS binaries + Docker + E2E

---

## v0.3.0 Scope — COMPLETED ✅ (2026-06-30)

**Features delivered**:
- [x] `src/agents/config.ts` — agents.yaml schema + arktype validation + role resolver + fs.watch hot-reload
- [x] `src/agents/ensemble.ts` — orchestrator entry with cost breakdown
- [x] `src/agents/strategies/{consensus,critic,best-of-n}.ts` — 3 strategies
- [x] `src/agents/resilience.ts` — withRetry + withTimeout + withFallback + CircuitBreaker
- [x] CLI `snscoder orchestrate <prompt> [--strategy S] [--agents r1,r2]` — stub until executor wired
- [x] 21 deterministic tests pass (strategies 6 + resilience 9 + config 6)
- [x] Binary rebuilt v0.3.0 (117MB, JS-only mode, `snscoder 0.3.0`)

**Quality gate**:
- [x] TS clean (0 errors)
- [x] 21/21 tests pass
- [x] Binary builds + runs (`./bin/snscoder-linux-x64 version` → `snscoder 0.3.0`)
- [x] All `orchestrate` and 6 other commands available in CLI

**Tag**: `v0.3.0` after Phase 6 E2E + npm publish

---

## Changes Log

| Date | Phase | Change | By |
|------|-------|--------|-----|
| 2026-06-30 | 5 | `src/agents/config.ts` agents.yaml schema + arktype validation | Hermes |
| 2026-06-30 | 5 | `src/agents/ensemble.ts` + 3 strategy implementations | Hermes |
| 2026-06-30 | 5 | `src/agents/resilience.ts` retry + circuit breaker + timeout + fallback | Hermes |
| 2026-06-30 | 5 | 21 deterministic tests (strategies/resilience/config) | Hermes |
| 2026-06-30 | 5 | CLI `orchestrate` command stub + binary v0.3.0 build | Hermes |
| 2026-06-30 | 5 | Fixed `src/async/index.ts` missing AsyncJobManager re-export | Hermes |
| 2026-06-30 | 5 | Splash version multi-path fallback + CWD walk | Hermes |
| 2026-06-30 | 5 | modes rebrand patches (welcome, splash, event-controller) | Hermes |
| 2026-06-30 | 5 | Premium TUI: command-palette + error-display + gradient + memory-toast | Hermes |
| 2026-06-27 | 5.3 | Async workflow engine + 21 tests + /task command | Hermes |