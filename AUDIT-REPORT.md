# SNS-MyAgent Deep Audit — Final Report

Audit date: 2026-08-17
Repository: `Reihantt6/sns-myagent` (branch `main`)
Baseline commit reference: `2654f2c` (UNIT 0) → `e0ba014` (UNIT 7) → session 5 fixes
Method: source-level trace of real runtime call paths (never README-as-proof), plus
hermetic tests, a TBM harness benchmark, and real screenshots from the running build.

**Session 5 (bug-hunt fix + final gate):** the two remaining CRITICAL/MEDIUM bug-hunt
findings were fixed and regression-tested — (UNIT Y1) `tools.approvalMode` default
`yolo` → `always-ask`, and (UNIT Y2) `resolveReadPath` now rejects relative `../`
escape above the workspace. Full committed gate re-run: `bun test src` 316/2/0,
`bun test test/` 110/0, `tsc --noEmit` clean, `biome lint` clean, `bun run build`
success. See Security Gap Analysis, Changes Made, and Tests Executed below.

Classification vocabulary: `VERIFIED`, `PARTIALLY_VERIFIED`, `IMPLEMENTED_UNTESTED`,
`STUB`, `EXPERIMENTAL`, `PLANNED`, `BROKEN`, `DOC_ONLY`, `UPSTREAM_INHERITED`.

---

## Executive Summary

**What genuinely works (VERIFIED):**

- **Memory — `mnemopi` backend**: the full path `user input → retain → persistent
  storage → new process → recall → context injection → model` is demonstrated. Explicit
  retain, cross-process restart persistence, semantic recall, auto-retain, auto-recall
  injection, the injection-token budget invariant, clear/delete, backend `off`, backend
  switching, and per-project scope isolation are all covered by
  `src/memory-backend/__tests__/memory-integration.test.ts` (30 tests, all green).
- **Core agent loop, tools, slash commands, TUI, eval runtimes, cron, async task store**
  pass their committed test suites (`bun test src` = 299 pass / 0 fail;
  `bun test test/` = 63 pass / 0 fail).
- **Build + typecheck + lint**: `bun run build` (compiled binary), `tsc --noEmit`, and
  `biome lint src test scripts` all pass.
- **Installer**: `install.sh`'s prebuilt-binary path was exercised end-to-end against the
  real v0.3.9 release (download + `--version` verification) and passes on linux-x64.
- **Telegram adapter** is wired end-to-end (message → handler → session → agent → model →
  tool → response → Telegram) and now has an opt-in authorization allowlist.

**What is partial:**

- `mem0`, `lcm`, `mnemosyne`, and `local` memory backends persist and recall manually but
  have **no auto-recall / context-injection path** (mnemopi is the only backend wired into
  `agent-session.ts`).
- Telegram: identity gate added, but it is **opt-in (off by default)** and the bridge still
  creates sessions with `autoApprove: true` (the allowlist narrows *who*, not *what*).
- Goal mode, subagents, MCP, cron, browser, plugins, collaboration: implemented and partly
  tested, but not deep-audited end-to-end in this pass (recorded, not hidden).

**What is missing / not integrated:**

- `mnemosyne` is dead code (migrated to `mnemopi` at settings load) yet remains a selectable
  enum value.

**Integrated in the follow-up pass (session 2, commit `a59bb93`):**

- **TBM (`src/tbm/`)** is now wired into the main agent turn lifecycle (pre-model
  comm-mode/tombstone/delta/pyramid/lazy-skills, post-tool compression, post-turn response
  cache store), with a `tbm.*` settings schema (default OFF) and a unified token counter.
  See the TBM Audit section.

**Security posture:** one CRITICAL finding (Telegram had no authorization boundary) was
mitigated with an opt-in allowlist; one HIGH finding (cross-project memory leakage from a
shared SQLite singleton) was fixed. Remaining risk is recorded in Security Gap Analysis.

---

## Feature Verification Matrix

| Feature | Implemented | Tested | Documented | Screenshot | Status |
|---|---:|---:|---:|---:|---|
| Setup wizard | yes | yes (unit) | yes | yes (`setup-wizard.png`, `setup-glyphs.png`) | VERIFIED |
| Memory — mnemopi | yes | yes (30 tests, full path) | yes | yes (`memory-stats.png`, `memory-diagnose.png`) | VERIFIED |
| Memory — mem0/lcm/mnemosyne/local | yes | yes (hermetic save/search/clear) | yes | — | PARTIALLY_VERIFIED (no auto-recall) |
| Memory — mnemosyne | dead | migrated at load | yes | — | BROKEN (dead code) |
| TBM | yes | yes (unit + harness + real-turn integration) | yes (`docs/tbm.md`) | — | VERIFIED (integrated) |
| Telegram | yes | yes (handlers + auth gate) | yes | — | PARTIALLY_VERIFIED (auth opt-in) |
| Goal mode | yes | partial | partial | — | PARTIALLY_VERIFIED |
| Subagents / multi-agent | yes | partial | partial | — | PARTIALLY_VERIFIED |
| MCP | yes | partial | partial | yes (`mcp.png`) | PARTIALLY_VERIFIED |
| Cron | yes | yes (parser) | partial | — | PARTIALLY_VERIFIED |
| Browser (puppeteer) | yes | partial | partial | — | PARTIALLY_VERIFIED |
| Plugins | yes | — | partial | — | IMPLEMENTED_UNTESTED |
| Collaboration | yes | — | partial | — | IMPLEMENTED_UNTESTED |

Evidence pointer: the README "Verification Status (audit)" table mirrors this matrix; each
`VERIFIED`/`PARTIALLY_VERIFIED` entry names its evidence file.

---

## Memory Audit

**Backend resolution** (`src/memory-backend/resolve.ts`) maps `memory.backend` →
`mnemopi | hindsight | mem0 | lcm | mnemosyne | local | off`. Schema default is `off`.

**Full-path proof (mnemopi):**

| Step | Evidence |
|---|---|
| retain | `mnemopi` `save` persists to local SQLite |
| persistent storage | on-disk DB under the per-project memory root |
| new process/session | test constructs a *fresh* state (process B) and recalls |
| recall | semantic `search` returns the retained fact (paraphrased query) |
| context injection | `beforeAgentStartPrompt` (via `agent-session.ts`) injects a recalled-memory block on the first turn; `injectionTokenLimit` truncates `buildDeveloperInstructions` |
| model | the injected block is part of the start prompt sent to the model |

Test coverage (`src/memory-backend/__tests__/memory-integration.test.ts`, 30 passing):
2.1 explicit retain, 2.2 restart persistence, 2.3 semantic recall + false-positive check,
2.4 auto-retain on/off, 2.5 auto-recall injection (first turn only), 2.6
`injectionTokenLimit` invariant, 2.7 clear/delete, 2.8 backend `off` (no persistence),
2.9 backend switching, 2.10 per-project scope isolation.

**Bugs found and fixed:**

1. **Scope-isolation leak (HIGH):** `mem0`, `lcm`, and `mnemosyne` kept a module-level
   `let db` singleton that ignored `agentDir`, so a second project in one process shared the
   first project's SQLite. Fixed by keying open handles by resolved path.
2. **`lcm` FTS corruption:** `lcm`'s schema lacked the FTS5 `AFTER UPDATE` trigger (mem0 has
   one), so its post-save `UPDATE` corrupted the FTS index and `clear()` threw
   `database disk image is malformed`. Fixed by adding the update trigger.

**Remaining limitations:** `mem0`/`lcm`/`mnemosyne`/`local` have manual save/search only —
no auto-recall or injection into agent context. `mnemosyne` is unreachable (migrated to
`mnemopi` at settings load) but still selectable in the schema enum.

---

## TBM Audit

**Integration result: INTEGRATED (session 2, commit `a59bb93`).** Previously `TbmManager`
had zero construction sites; it is now wired into the real agent turn lifecycle:

- `createAgentSession` (`src/sdk.ts`) builds a `TbmManager` from settings and passes it to
  both the agent's `transformContext` (pre-model) and `AgentSession` (`session.tbm`,
  post-tool / post-turn).
- `session.tbm` is assigned, so `/tbm` and `/tbm mode` now render a real dashboard and
  switch comm mode instead of reporting "TBM not initialized".
- `tbm.*` keys exist in `src/config/settings-schema.ts` (master switch defaults **OFF**) and
  are bridged to `TbmConfig` by `resolveTbmConfigFromSettings`.
- Token counting is unified: `src/tbm/context-delta.ts` `estimateTokens` delegates to
  `@oh-my-pi/pi-agent-core` `countTokens`.

**Subsystem-by-subsystem wiring** (`src/tbm/session-hooks.ts`):

| Subsystem | Hook | Runs on a real turn? |
|---|---|---|
| `comm-modes.ts` | `transformContext` → `applyTbmPreModel` | yes |
| `context-delta.ts` | `transformContext` → `applyTbmPreModel` (accounting) | yes |
| `context-pyramid.ts` | `transformContext` → `applyTbmPreModel` | yes |
| `lazy-skills.ts` | `transformContext` → `applyTbmPreModel` | yes |
| `tombstone.ts` | `transformContext` → `applyTbmPreModel` | yes |
| `tool-compress.ts` | `Agent.afterToolCall` → `applyTbmToolCompression` | yes |
| `response-cache.ts` | `Agent.setOnTurnEnd` → `cacheTbmTurnResponse` (store-only) | yes |
| `dashboard.ts` | `/tbm` slash command via `session.tbm` | yes |
| `config.ts` | `resolveTbmConfigFromSettings` at session creation | yes |

**Runtime diagram (actual call paths):**

```text
User Turn
  ↓
Agent Loop (src/sdk.ts transformContext, src/session/agent-session.ts)
  ↓
TbmManager (built in createAgentSession when tbm.enabled)
  ├─ context delta        ✓ accounting (transformContext)
  ├─ context pyramid      ✓ (transformContext)
  ├─ lazy skills          ✓ (transformContext)
  ├─ tombstone            ✓ (transformContext, plain-text messages only)
  ├─ communication mode   ✓ directive injection (transformContext)
  ├─ tool compression     ✓ (afterToolCall)
  └─ response cache       ✓ store-only (turn end)
  ↓
model request (comm directive + tombstoned messages affect the payload)
```

**Honest limitations:** the response cache is store-only (a hit does not skip the model),
context delta is accounting-only (it never drops the provider-cached prefix), and tombstone
only touches plain-text `user`/`assistant` messages so tool-call pairing survives.

**Integration tests.**
- `src/tbm/__tests__/tbm-session-integration.test.ts` (12 tests) proves observable payload
effects: comm-mode directive injected, old messages replaced by tombstones (originals do not
re-enter verbatim; tool-call messages skipped), oversized tool output truncated, query/response
cached, and `tbm.*` config consumed with a schema default of OFF.
- `src/tbm/__tests__/tbm-agent-loop.test.ts` (4 tests, session 3) drives the **real
pi-agent-core `Agent.prompt` loop** through `composeTransformContext` — the exact seam
`createAgentSession` uses — and asserts observable payload effects (directive, tombstone,
lazy-skills load-only-when-referenced, disabled-payload-identical). Mutation-verified:
removing `applyTbmPreModel` from the seam fails 3/4 tests, so the wiring is regression-proof.
- Session 3 also fixed a real gap the hardening test exposed: `lazy-skills.processMessage`
advanced stats but discarded its result, so loaded skill content never reached the model
payload. `applyTbmPreModel` now injects the name index plus the full content of only the
referenced skills.
- The response-cache **store path** (`cacheTbmTurnResponse`) is exercised at the hook level in
`tbm-session-integration.test.ts`; it is wired into the real `setOnTurnEnd`
(`src/session/agent-session.ts`), but pi-agent-core does not fire `onTurnEnd` from a minimal
mock stream, so it is not asserted through `Agent.prompt` (documented, not overclaimed).

**Benchmark (harness-only, NOT end-to-end).** `bun scripts/tbm-benchmark.ts` drives
`TbmManager` directly on a synthetic 20-turn conversation:

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

The measured 93.6% on-wire content-token reduction is a **harness** number dominated by the
context-delta cache dropping a mostly-static synthetic prefix. It is **not** claimed as a
real-session saving. No unsupported savings claim remains — `docs/tbm.md` states this.

---

## Documentation Gap

Docs audited against source; corrected where they diverged from reality:

| Doc | Action |
|---|---|
| `README.md` | rewritten: verification matrix, corrected memory/TBM/Telegram/install claims, screenshot table |
| `docs/tbm.md` | rewritten: documents the integrated lifecycle wiring, config, and measured harness numbers |
| `docs/termux.md` | corrected: npm/prebuilt binary is glibc and does not run on Android; source-run is the viable path |
| `docs/security-model.md` | new: evidence-based attack-surface table + severity ratings |
| `docs/upstream.md` | new: lineage, dependency-drift table, backport recommendation |
| `docs/troubleshooting.md` | corrected JS-only-mode/TUI note |
| `docs/development.md` | new (session 3): custom node_modules postinstall + pi-natives patch + drift table |
| `docs/memory.md` | rewritten (session 4): correct backend table (default `off`, `mnemosyne` dead, `mem0`/`lcm` local) + template |
| `docs/architecture.md` | new (session 4): runtime agent-loop integration points |
| `docs/telegram.md` | new (session 4): Telegram adapter + authorization boundary |

Remaining doc gap: no dedicated deep pages for goals/subagents/MCP/cron/browser/plugins/
collaboration beyond README coverage (recorded, not created for volume).

Session 4 follow-up: deep pages added for goals, plan-mode, subagents, MCP, cron,
browser, compaction, extensibility (plugins/skills), collab, and advisor — each using
the Purpose / How it works / Configuration / Real example / Expected behavior /
Failure behavior / Limitations / Testing status template, with statuses matching the
feature matrix (PARTIAL/UNTESTED where the audit found partial or no committed tests).

Session-4 installer test (2026-08-17): install.sh was traced and exercised in
isolation. Prebuilt path (linux/x64), Termux path (detects via TERMUX_VERSION /
/data/data/com.termux / `uname -o`; routes to source build), and API-failure
fallback (mocked rate-limit → source build) all install a working `snsagent
0.3.9`. macOS asset names (`snsagent-macos-*`) confirmed. **Remaining action
(push required, not performed)**: commit `e0ba014` (macOS asset naming + Termux
route) is on HEAD but not yet fetched into `origin/main`; the `curl | bash`
one-liner still serves the older installer, which attempts the prebuilt path on
Termux and could install a non-executing binary. Push e0ba014 (and the session-4
commits) to make the one-liner match the verified behavior.

---

## Screenshot Inventory

10 real PNGs captured from the current source-run build (`bun run src/cli/entry.ts`) via
tmux + an ANSI→PNG renderer. All sanitized (no keys/tokens/paths). Located in
`docs/screenshots/`, linked from the README:

| File | Screen |
|---|---|
| `setup-wizard.png` | first-launch BYOK provider wizard |
| `setup-glyphs.png` | setup glyph mode |
| `main-tui.png` | main TUI |
| `settings.png` | `/settings` |
| `model.png` | `/model` picker |
| `memory-stats.png` | `/memory stats` |
| `memory-diagnose.png` | `/memory diagnose` |
| `mcp.png` | `/mcp` surface |
| `stats.png` | `/stats` dashboard launch |
| `help.png` | representative error state (no model selected) |

Note: the compiled binary runs in JS-only mode (native pty/grep/shell disabled) and its
interactive TUI does not render in the audit environment; the screenshots therefore come
from the source-run path, which is the supported interactive path.

---

## Security Gap Analysis

Severity scale: CRITICAL / HIGH / MEDIUM / LOW / INFO. Full evidence in
`docs/security-model.md`.

| Finding | Severity | Status |
|---|---|---|
| Telegram had **no authorization boundary** (arbitrary `userId`, no allowlist) | CRITICAL | MITIGATED — opt-in `SNS_TELEGRAM_ALLOWED_USERS` allowlist + startup warning when unset |
| Telegram bridge runs tools with `autoApprove: true` (allowlist narrows *who*, not *what*); `userId` discarded (CLI hardcodes `"telegram"`) | HIGH | DOCUMENTED |
| Cross-project memory leakage via shared SQLite singleton (mem0/lcm/mnemosyne) | HIGH | FIXED |
| `lcm` `clear()` FTS corruption | MEDIUM | FIXED |
| MCP / plugins / goals / subagents supply-chain & prompt-injection trust on the user | MEDIUM | DOCUMENTED |
| bash / eval / write / ssh / browser / cron surfaces (approval policy + sandbox inherited) | MEDIUM | INHERITED |
| Dead code: `src/tbm/`, `mnemosyneBackend` | INFO | DOCUMENTED |
| Secrets | LOW | INHERITED (never logged; never read during audit) |
| `tools.approvalMode` schema default was `yolo` (auto-approve) — a fresh config auto-approved *all* tool calls, including critical bash patterns (`rm -rf /`, `curl \| bash`) | MEDIUM | **FIXED** (UNIT Y1) — default is now `always-ask`; yolo is explicit opt-in only |
| Read-tool path resolution did not sandbox to cwd — `../` traversal resolved outside the workspace (proven: `resolveReadPath("../outside/secret.txt", ws)` read the file) | MEDIUM | **FIXED** (UNIT Y2) — `resolveReadPath` rejects relative paths escaping cwd; absolute/`~` paths still allowed |
| Response cache semantic match false-positives on single-word queries — any single-word query matches any other (zero-bigram branch returns 1.0) | LOW | DOCUMENTED (TBM default OFF; store-only cache, never skips the model) |
| Tombstone `tokensSaved` could be **negative** and `compressionRatio` > 1 for non-compressible (single-sentence) messages | LOW | **FIXED** — clamped `>= 0` / `<= 1` + regression test |
| `Settings.get()/isConfigured()` with an undeclared path threw a raw `TypeError` (`for..of undefined` in `getByPath`) | LOW | **FIXED** — friendly `Unknown setting path` error + regression test |

Observability: 217 structured `logger.debug/warn` sites; auth-gate logs (`userId`, `chatId`)
added this audit. The core loop does not yet attach session/turn/tool-call IDs to every log
line — recorded improvement, not a regression.

---

## Upstream Comparison

SNS-MyAgent is a customization of `can1357/oh-my-pi` (depends on `@oh-my-pi/*`, layers a
custom CLI, Telegram adapter, `src/tbm/`, and the memory-backend abstraction). See
`docs/upstream.md` for the full table.

| Upstream change | SNS status | Impact | Action |
|---|---|---|---|
| v17.x package line (17.3.5) | behind (16.1.18) | high | compat spike before any upgrade; do not blind-merge |
| remote-control / Telegram (#436) | SNS has its own adapter | low | ignore (intentional divergence) |
| hindsight memory | present (adapted) | low | monitor |
| mnemopi embeddings | present (adapted + patched natives) | medium | re-validate patch against v17 before upgrade |

Telegram is the clearest SNS-only surface (upstream only has an open request, not a shipped
adapter).

---

## Dependency Drift

All `@oh-my-pi/*` packages are pinned `^16.1.18`; the upstream line is at 17.3.5 — **one
major version behind** across the board (`pi-agent-core`, `pi-ai`, `pi-mnemopi`,
`pi-natives`, `pi-tui`, `pi-catalog`, `pi-utils`, `pi-wire`, `hashline`, `omp-stats`,
`snapcompact`). No `@sns-myagent/*` scoped deps exist beyond the project itself
(`@sns-myagent/cli`).

Custom `postinstall` (must stay intact, verified clean):
1. `scripts/fetch-binary.mjs` — downloads the prebuilt binary (~112 MB) from the latest
   release; non-fatal on failure.
2. `scripts/apply-pi-natives-patch.js` — applies `patches/pi-natives-js-only-fallback.patch`
   so a compiled Bun binary starts in JS-only mode instead of crashing. Idempotent
   ("already fully patched" on re-run).

`bun install` completed cleanly during the audit.

---

## Changes Made

| File(s) | Rationale |
|---|---|
| `src/memory-backend/{mem0,lcm,mnemosyne}-backend.ts` | fix cross-project SQLite handle leak (key by resolved agentDir) |
| `src/memory-backend/lcm-backend.ts` | add FTS5 `AFTER UPDATE` trigger to repair `clear()` corruption |
| `src/memory-backend/__tests__/memory-integration.test.ts` | add full memory-path tests (2.1–2.10, all backends) |
| `src/adapters/telegram/{bot,index}.ts`, `src/cli/{index,entry}.ts` | add opt-in `SNS_TELEGRAM_ALLOWED_USERS` authorization gate + startup warning |
| `test/telegram-audit.test.ts` | add auth-gate tests |
| `src/tbm/__tests__/tbm-audit.test.ts`, `scripts/tbm-benchmark.ts` | integrate/expand TBM unit + harness coverage |
| `src/tbm/session-hooks.ts`, `src/tbm/settings-bridge.ts`, `src/config/settings-schema.ts`, `src/sdk.ts`, `src/session/agent-session.ts`, `src/tbm/context-delta.ts` | wire TBM into the main turn lifecycle; add `tbm.*` config; unify token counting (session 2) |
| `src/tbm/__tests__/tbm-session-integration.test.ts` | real-turn integration test (12 tests) |
| `scripts/tbm-benchmark.ts` | report input/total tokens + model-call count; refresh scope note |
| `docs/tbm.md`, `docs/security-model.md`, `docs/upstream.md`, `docs/termux.md`, `docs/troubleshooting.md`, `README.md` | align docs with verified reality |
| `install.sh`, `scripts/fetch-binary.mjs` | fix macOS asset naming (darwin→macos); hard-fail on broken `--version`; route Termux to source build |
| `AUDIT-BASELINE.md` | record re-verified baseline + WIP test isolation findings |
| `src/tbm/session-hooks.ts` | inject lazy-skill content into the payload (was stats-only) |
| `src/tbm/__tests__/tbm-agent-loop.test.ts` | real pi-agent-core loop regression-proof test (4 tests) |
| `src/async/task-runner.ts`, `src/async/__tests__/task-runner.test.ts` | guard `#executeTask` finally block against closed store after `destroy()`; regression test |
| `src/async/task-store.ts` | inclusive (`<=`) cleanup cutoff to stop ms-boundary flake |
| `src/config/settings-schema.ts`, `src/extensibility/extensions/wrapper.ts`, `src/session/agent-session.ts` (comment) | **UNIT Y1** — `tools.approvalMode` default `yolo` → `always-ask` (safe default; yolo is explicit opt-in) |
| `src/tools/path-utils.ts` | **UNIT Y2** — `resolveReadPath` rejects relative `../` paths escaping cwd (workspace guard); absolute/`~` paths allowed |
| `test/security-b1.test.ts` | **UNIT Y1/Y2** — B1.1 asserts the new `always-ask` default + critical-payload prompt; B1.3 asserts `../` rejection, absolute-path escape hatch, and in-workspace resolution |
| `docs/security-model.md`, `AUDIT-REPORT.md` | record the two CRITICAL/MEDIUM fixes as FIXED |

Session 1 commits (one per unit): `2654f2c`, `7e36b36`, `ac33a42`, `f93606a`, `5b28dc8`,
`20a43d0`, `8e717e6`, `e0ba014`. Session 2 commits: `a59bb93` (TBM integration + tests),
`1814f06` (benchmark metrics), `e5a4006`/`c83bbfd` (regression-proof loop test + scope note),
`2d29f72` (docs). Session 3 commits: `5463807` (task-runner shutdown guard),
`8b1b08e` (cleanup inclusive cutoff).

Files intentionally left untracked (per task HARD RULES): `agent/`, `.agents/`, `.claude/`,
`skills-lock.json`, plan files.

---

## Tests Executed

| Command | Result |
|---|---|
| `bun test src` | **316 pass / 2 skip / 0 fail** (30 files) — stable across 3 consecutive runs after the two flake fixes below |
| `bun test src/tbm/__tests__/` | 16 pass / **0 fail** (2 files) — 4 real-loop regression-proof + 12 hook-level integration |
| `bun test src/memory-backend/__tests__/memory-integration.test.ts` | 30 pass / **0 fail** — memory path re-verified |
| `bun test test/` | 63 pass / **0 fail** (4 files) — committed integration tests |
| `bun test` (whole tree) | **863 tests** / 56 fail / 3 errors — **all failures in untracked `agent/skills/**`** (vendored third-party skills with missing external deps); committed `src/` + `test/` fully green |
| `bun run build` | exit 0 — produces `bin/snsagent-linux-x64` + `bin/snsagent` (117 MB) |
| `bunx tsc -p tsconfig.json --noEmit` | exit 0 — typecheck passes (package.json `check:types` uses `tsgo`, not installed; `tsc` is the working equivalent) |
| `bunx biome lint src test scripts` | exit 0 (biome 0.3.3) |
| `bun scripts/tbm-benchmark.ts` | runs — measured OFF/ON numbers recorded in TBM Audit |
| `install.sh` prebuilt path (sandboxed) | linux-x64 download + `--version` verified against real v0.3.9 release |
| **Phase 4B** `bun test test/security-b1.test.ts` | 18 pass / 0 fail — approval-mode default, critical bash patterns, path traversal |
| **Phase 4B** `bun test test/security-b2.test.ts` | 8 pass / 0 fail — Telegram auth edges, hostile config, secret leakage |
| **Phase 4B** `bun test test/security-b3.test.ts` | 9 pass / 0 fail — cross-session memory isolation, response cache, tombstone (+ clamp regression) |
| **Phase 4B** `bun test test/security-b4.test.ts` | 10 pass / 0 fail — corrupt config/session files, wrong types, extreme unicode |
| **Phase 4B** `bunx tsc --noEmit` | exit 0 |
| **Phase 4B** full `bun test` (with 4B changes) | 850 pass / 56 fail / 3 errors — **failure count unchanged from baseline** (stash comparison: 848/58 without changes); all 56 are pre-existing env-dependent failures (hyperframes/HeyGen/svgl/favicon/ffprobe network & media tests), none caused by 4B |
| **UNIT Y1/Y2** `bun test test/security-b1.test.ts` | 20 pass / 0 fail — new `always-ask` default, critical-payload prompt, `../` traversal rejection (regression-proof) |
| **UNIT Y1/Y2** `bun test test/` | 110 pass / 0 fail (8 files) — committed integration + B1–B4 suites |
| **UNIT Y1/Y2** `bun test src` | 316 pass / 2 skip / 0 fail (30 files) — unchanged from baseline |
| **UNIT Y1/Y2** `bunx tsc -p tsconfig.json --noEmit` | exit 0 |
| **UNIT Y1/Y2** `bunx biome lint src test scripts` | exit 0 |
| **UNIT Y1/Y2** `bun run build` | exit 0 — `bin/snsagent-linux-x64` produced |

---

## Fuzz / Bug Hunt (Phase 4B)

Security-focused bug hunt over the four surfaces below. Every finding was proven with a
committed test (`test/security-b*.test.ts`); no claim without evidence.

### B1 — Injection & command execution

- **~~Default approval mode is `yolo`~~ FIXED (UNIT Y1).** The schema default was `yolo`
  (auto-approve every tier), so a fresh config auto-approved even critical-pattern `rm -rf /`.
  The default is now `always-ask` (read-only auto-approve; write/exec prompt) in
  `src/config/settings-schema.ts` and the extension wrapper fallback. `yolo` remains explicit
  opt-in (`--yolo` / `--approval-mode yolo` / `tools.approvalMode: yolo`) and subagents still
  run headless in yolo mode behind the parent-task boundary. Regression test: `test/security-b1.test.ts`
  B1.1 (fresh config now prompts on critical payloads; explicit yolo still allows).
- **Critical bash patterns are detected** when a non-yolo mode is active: `rm -rf /`, `rm -fr /`,
  `sudo rm /etc/passwd`, fork bomb, `curl | bash`, `wget | sh`, `eval "$(curl …)"`,
  `bash <(curl …)`, `dd … of=/dev/sda`, `shutdown now` all match `CRITICAL_BASH_PATTERNS`
  (12/12 cases verified); benign `echo`/`git status` do not. **Verified good.**
- **~~Path traversal is not guarded~~ FIXED (UNIT Y2).** `resolveReadPath("../outside/secret.txt", ws)`
  previously resolved outside the workspace and the file was readable. `resolveReadPath` now
  rejects a RELATIVE path that escapes `cwd` with a `ToolError`; absolute and `~`-expanded paths
  remain readable as explicit user intent (legitimate reads of configs/images outside the
  workspace keep working). `resolveToCwd` (used by bash/debug, where escaping is legitimate) is
  intentionally unchanged. Regression tests: `test/security-b1.test.ts` B1.3 (rejection,
  absolute escape hatch, in-workspace resolution).

### B2 — Auth & access

- **Telegram auth edges verified good:** a message with no `from` (channel post/service message)
  yields `userId 0`, which never passes the allowlist; allowlist parsing normalizes whitespace/
  junk (`" 42 , 0, -5, abc, 7 "` → `{7, 42}`). **Verified good.**
- **Hostile config values do not crash** the settings layer: wrong-typed values
  (`memory.backend: 12345`, `tbm.enabled: "yes"`, `compaction.thresholdPercent: "abc"`),
  1 MB string values, and path-traversal values (`mnemopi.dbPath: "../../../../etc/shadow"`)
  all resolve without throwing. Traversal-in-value is a documented backend responsibility, not
  a settings-layer crash. **Verified good.**
- **FIXED — `Settings.get()` raw TypeError.** `get("modelRoles.default")` (a record, not a
  declared `SettingPath`) threw a raw `TypeError` from `for..of undefined` in `getByPath`.
  Extensions/plugins/JS config can hit this with arbitrary strings. Now throws a friendly
  `Unknown setting path: …` Error in both `get()` and `isConfigured()`. **LOW, FIXED** + regression
  test.
- **Secret leakage:** a dummy `sk-…` key never appears in captured stdout/stderr during a
  settings/config-resolution flow (monkeypatched write test). The `token` command prints keys
  only on explicit user request (by design). **Verified good.**

### B3 — Memory & cache poisoning

- **Cross-session memory isolation holds:** a fact saved in agentDir A (mnemopi, separate
  dbPath) is NOT recalled from agentDir B; A still recalls its own fact (control). **Verified good.**
- **Response cache overwrite = invalidation:** re-setting a query replaces the old response;
  TTL expiry and `clear()` both drop entries. **Verified good.**
- **Semantic cache false-positive on single-word queries:** `set("deploy", …)` then
  `get("status")` returns a semantic `hit` — both are single words, zero bigrams, so the
  both-empty jaccard branch returns 1.0. **LOW, DOCUMENTED** (TBM default OFF; cache is
  store-only and never skips the model, so real-world impact is a misleading accounting stat).
- **FIXED — tombstone negative savings.** `ConversationTombstoner` reported a **negative**
  `tokensSaved` and `compressionRatio > 1` for single-sentence messages (summary ≈ original,
  +5 formatting overhead). Now clamped to `>= 0` / `<= 1`. **LOW, FIXED** + regression test.
- **Tombstone non-reentry holds:** tombstoned messages never re-enter verbatim; originals stay
  retrievable by hash (documented contract). **Verified good.**

### B4 — Robustness / light fuzz

- **Corrupt `config.yml`** (broken YAML, scalar/array) loads with defaults — no stacktrace.
  **Verified good.**
- **Corrupt session files** (garbage bytes, truncated header, partial trailing JSON line)
  load leniently — bad rows skipped, intact rows survive. **Verified good.**
- **Extreme unicode / 100 KB+ input** into `parseSlashCommand`, `parseSubcommand`, and
  `parseCommandArgs` (NUL bytes, emoji, unclosed quotes) never throws or hangs. **Verified good.**

---

## Remaining Risks

1. **TBM is integrated but real-session savings are unproven** — the response cache is
   store-only (hits do not skip the model) and context delta is accounting-only (it never
   drops the provider-cached prefix). End-to-end token savings need a real-model benchmark.
2. **Telegram authorization is opt-in** — `SNS_TELEGRAM_ALLOWED_USERS` defaults to open; a
   misconfigured deployment is still an unauthenticated remote-execution surface.
3. **Telegram tools auto-approve** — `autoApprove: true` remains; the allowlist gates entry
   but not per-action approval.
4. **`@oh-my-pi/*` is one major version behind (16.1.18 vs 17.3.5)** — upgrading is high-risk
   and must re-validate the `pi-natives` patch.
5. **Non-mnemopi memory backends have no auto-recall/injection** — only mnemopi feeds the
   agent context.
6. **`mnemosyne` is dead but still selectable** in the settings enum (misleading UI).
7. **`check:types` uses `tsgo`** which is not installed; the script fails as-is until `tsgo`
   is added or the script switched to `tsc`.
8. **Untracked `agent/skills/**` vendored-skill tests fail** (missing external deps); they
   are excluded from the committed tree and this report's green numbers.
9. **Observability IDs** (session/turn/tool-call) are not yet attached to every core-loop log
   line.
10. **`bun test` runs all files in one non-isolated process** — module-level singletons
   (e.g. `TaskStore`/`TaskRunner`) are shared across test files. Two shared-DB flake bugs
   exposed by this were fixed (session 3, commits `5463807`, `8b1b08e`); other singletons
   remain a latent cross-file coupling risk if a test closes shared state.
11. **~~`tools.approvalMode` defaults to `yolo`~~ FIXED (UNIT Y1)** — the schema default is
    now `always-ask`, so a fresh config prompts for write/exec tools instead of auto-approving
    everything (including critical bash patterns). `yolo` remains explicit opt-in
    (`--yolo` / `tools.approvalMode: yolo`) and subagents still run headless in yolo mode
    behind the parent-task approval boundary.
12. **~~Read tool is not cwd-sandboxed~~ FIXED (UNIT Y2)** — `resolveReadPath` now rejects
    relative `../` paths that escape the workspace; absolute and `~`-expanded paths remain
    readable as explicit user intent (legitimate reads of configs/images outside the
    workspace keep working).
13. **Response cache false-positives on single-word queries** (Phase 4B) — semantic matcher
   treats any two single-word queries as identical. LOW (TBM default OFF, store-only).

---

## Exit Criteria

- [x] baseline is recorded
- [x] memory persistence is proven
- [x] memory recall is proven
- [x] auto-retain is proven
- [x] auto-recall is proven
- [x] memory injection budget is verified
- [x] memory clear/delete is verified
- [x] TBM unit tests pass
- [x] TBM main-loop integration is proven (session-hooks wired into transformContext, afterToolCall, turn-end)
- [x] TBM benchmark data exists
- [x] no unsupported TBM savings claim remains
- [x] Telegram end-to-end path is tested
- [x] Telegram authorization boundary is assessed
- [x] docs are audited against source
- [x] real screenshots are added
- [x] screenshots are sanitized
- [x] upstream comparison is complete
- [x] dependency drift is documented
- [x] security gaps are documented
- [x] relevant regression tests are added
- [x] full (committed) test suite passes
- [x] build passes
- [x] typecheck/lint passes where available
- [x] README/docs reflect verified behavior
