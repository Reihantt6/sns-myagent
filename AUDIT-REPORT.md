# SNS-MyAgent Deep Audit — Final Report

Audit date: 2026-08-17
Repository: `Reihantt6/sns-myagent` (branch `main`)
Baseline commit reference: `2654f2c` (UNIT 0) → final `e0ba014` (UNIT 7)
Method: source-level trace of real runtime call paths (never README-as-proof), plus
hermetic tests, a TBM harness benchmark, and real screenshots from the running build.

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

- **TBM (`src/tbm/`)** is **not wired into the main agent loop**. Zero construction sites
  exist outside `src/tbm/` and its test/benchmark harness; there is no `tbm.*` settings
  schema key; the `/tbm` slash command is inert. This is the single largest functional gap.
- `mnemosyne` is dead code (migrated to `mnemopi` at settings load) yet remains a selectable
  enum value.

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
| TBM | yes (self-contained) | yes (unit + harness) | yes (`docs/tbm.md`) | — | IMPLEMENTED_UNTESTED (not integrated) |
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

**Integration result: NOT INTEGRATED.** Verified by call-graph audit, not assumed:

- No `new TbmManager(...)` anywhere outside `src/tbm/` + its test/benchmark harness.
- `/tbm` and `/tbm mode` read `session.tbm`, but nothing ever assigns `session.tbm`, so the
  command always reports "TBM not initialized".
- No `tbm.*` key in `src/config/settings-schema.ts`; `resolveTbmConfig()` /
  `DEFAULT_TBM_CONFIG` have zero callers outside `src/tbm/`.

**Subsystem-by-subsystem** (all: no external callers, do not run on a real agent turn):

| Subsystem | External callers | Runs on a real turn? |
|---|---:|---:|
| `comm-modes.ts` | none | no |
| `context-delta.ts` | none | no |
| `context-pyramid.ts` | none | no |
| `lazy-skills.ts` | none | no |
| `response-cache.ts` | none | no |
| `tombstone.ts` | none | no |
| `tool-compress.ts` | none | no |
| `dashboard.ts` | none | no |
| `config.ts` | none | no |

The `estimateTokens` used in `agent-session.ts` is imported from `@oh-my-pi/pi-agent-core`,
**not** from TBM. The token budgets that *are* wired in (`src/goals/runtime.ts`,
`src/task/executor.ts`, `src/modes/turn-budget.ts`) are independent of `TbmManager`.

**Runtime diagram (actual call paths):**

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

**Benchmark (harness-only, NOT end-to-end).** `bun scripts/tbm-benchmark.ts` drives
`TbmManager` directly on a synthetic 20-turn conversation:

| Metric | TBM OFF | TBM ON |
|---|---:|---:|
| content tokens sent | 28,510 | 1,836 |
| directive tokens | 0 | 890 |
| context-delta cache hits | 0/20 | 19/20 |
| tool outputs compressed | 0/20 | 20/20 |
| response cache hits | 0/20 | 10/20 |
| messages tombstoned | 0 | 700 |
| latency (subsystem calls only) | 1.6 ms | 9.4 ms |

The measured 93.6% on-wire content-token reduction is a **harness** number dominated by the
context-delta cache dropping a mostly-static synthetic prefix. It is **not** claimed as a
real-session saving. No unsupported savings claim remains in the repo — `docs/tbm.md` states
this explicitly.

---

## Documentation Gap

Docs audited against source; corrected where they diverged from reality:

| Doc | Action |
|---|---|
| `README.md` | rewritten: verification matrix, corrected memory/TBM/Telegram/install claims, screenshot table |
| `docs/tbm.md` | rewritten from design-intent to the verified "NOT integrated" finding + measured harness numbers |
| `docs/termux.md` | corrected: npm/prebuilt binary is glibc and does not run on Android; source-run is the viable path |
| `docs/security-model.md` | new: evidence-based attack-surface table + severity ratings |
| `docs/upstream.md` | new: lineage, dependency-drift table, backport recommendation |
| `docs/troubleshooting.md` | corrected JS-only-mode/TUI note |

Remaining doc gap: no dedicated deep pages for goals/subagents/MCP/cron/browser/plugins/
collaboration beyond README coverage (recorded, not created for volume).

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
| `docs/tbm.md`, `docs/security-model.md`, `docs/upstream.md`, `docs/termux.md`, `docs/troubleshooting.md`, `README.md` | align docs with verified reality |
| `install.sh`, `scripts/fetch-binary.mjs` | fix macOS asset naming (darwin→macos); hard-fail on broken `--version`; route Termux to source build |
| `AUDIT-BASELINE.md` | record re-verified baseline + WIP test isolation findings |

Commits (one per unit): `2654f2c`, `7e36b36`, `ac33a42`, `f93606a`, `5b28dc8`, `20a43d0`,
`8e717e6`, `e0ba014`.

Files intentionally left untracked (per task HARD RULES): `agent/`, `.agents/`, `.claude/`,
`skills-lock.json`, plan files.

---

## Tests Executed

| Command | Result |
|---|---|
| `bun test src` | 299 pass / 2 skip / **0 fail** (28 files) — committed unit tests |
| `bun test test/` | 63 pass / **0 fail** (4 files) — committed integration tests |
| `bun test` (whole tree) | 787 pass / 57 fail / 4 errors — **all failures in untracked `agent/skills/**`** (vendored third-party skills with missing external deps `@earendil-works/pi-coding-agent`, `hyperframes`); out of scope, left untracked |
| `bun run build` | exit 0 — produces `bin/snsagent-linux-x64` + `bin/snsagent` (117 MB) |
| `bunx tsc -p tsconfig.json --noEmit` | exit 0 — typecheck passes (package.json `check:types` uses `tsgo`, not installed; `tsc` is the working equivalent) |
| `bunx biome lint src test scripts` | exit 0 (biome 0.3.3) |
| `bun scripts/tbm-benchmark.ts` | runs (harness numbers recorded in TBM Audit) |
| `install.sh` prebuilt path (sandboxed) | linux-x64 download + `--version` verified against real v0.3.9 release |

---

## Remaining Risks

1. **TBM is not integrated** — `src/tbm/` is dead at runtime until someone wires `TbmManager`
   into `agent-session.ts` and adds a `tbm.*` schema entry. Real-session token savings are
   unproven.
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
- [x] TBM main-loop integration is proven or clearly marked missing (clearly marked **missing**)
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
