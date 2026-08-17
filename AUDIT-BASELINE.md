# Audit Baseline (recorded before changes)

- Repo: /root/projects/sns-myagent (github.com/Reihantt6/sns-myagent), branch main, up to date with origin/main.
- Untracked at start: `.agents/`, `.claude/`, `SKILLS_MANIFEST.md`, `SNS-MYAGENT-DEEP-AUDIT-TASK.md`, `agent/`, `skills-lock.json` (agent skills + audit task itself are not in git).
- Version: package.json `@sns-myagent/cli` 0.3.9. Bun 1.3.14, node v22.23.2.
- `git log -10 --oneline`:
  - fddacf1 fix(setup): route Tab/Shift+Tab into BYOK fields before tab-bar switching
  - 311acfd fix(cli): telegram start honors config token fallback (flag > env > config)
  - a059908 fix(eval): release per-execution timers/listeners when kernel dies mid-request
  - 8afef50 chore: remove stray src/cli/cli.ts placeholder file
  - 7476543 fix(exec): preserve failure status for aborted commands
  - 40d59ec fix(cli): avoid Telegram startup for utility commands
  - 0fc678c test
  - 8930544 test: fix python completion subprocess to resolve pi-ai via import.meta.resolve
  - f2039be docs: add unreleased changelog entries for keyboard nav fix and docs corrections
  - 6f71fba test: fix outdated tbm.test.ts to match current TBM API

## bun install
- Ran `bun install` (postinstall fetches snsagent-linux-x64 binary 111.93 MB, applies pi-natives patch). Result: OK, 303 installs across 329 packages, no changes.

## bun test (baseline)
- `bun test` → **721 pass, 2 skip, 53 fail, 5 errors** across 104 files (776 tests, ~31s).
- Failing files are concentrated in the untracked `agent/skills/` directory (not in git, not part of core src):
  - media-use/scripts/lib: logo-provider (8), telemetry (7), heygen-video-provider (7), recipe-store (4), prefs-store (4), candidates (4), stats (3), ltx-video-provider (3), misses (2), voice-provider (1), lut-preset-provider (1), heygen-search (1)
  - media-use/audio: tts (1)
  - hyperframes-animation: animation-map (2), package-loader (1)
  - hyperframes-creative: package-loader (1)
  - caveman-learn / caveman-explore: skill-file (1 each)
- Core `src/` and `test/` suites pass.

## Structure
- `src/` top-level: adapters, advisor, agents, async, autolearn, autoresearch, auto-thinking, capability, cli, collab, commands, commit, config, cron, cursor, dap, debug, discovery, edit, eval, exa, exec, export, extensibility, goals, hindsight, index.ts, internal-urls, irc, jsonrpc, lib, lsp, main.ts, markit, mcp, memories, memory-backend, mnemopi, modes, plan-mode, priority.json, prompts, registry, sdk.ts, secrets, session, slash-commands, ssh, startup-splash.ts, stt, subprocess, system-prompt.ts, task, tbm, telemetry-export.ts, thinking.ts, tiny, tool-discovery, tools, tts, tui, ui, utils, web, workspace-tree.ts
- `src/tbm/`: comm-modes.ts, config.ts, context-delta.ts, context-pyramid.ts, dashboard.ts, index.ts, lazy-skills.ts, response-cache.ts, tombstone.ts, tool-compress.ts, __tests__/tbm.test.ts
- `src/adapters/telegram/`: bot.ts, bridge.ts, format.ts, handler.ts, index.ts
- `src/memory-backend/`: resolve.ts, runtime.ts, mem0-backend.ts, types.ts, index.ts, lcm-backend.ts, mnemosyne-backend.ts, local-backend.ts, off-backend.ts
- `src/__tests__` present in: cron, async, eval, tbm, tools, config, agents, advisor, modes.
- `test/`: exec.test.ts, cli.test.ts, telegram.test.ts

## Config consumers (grep)
- `tbm:` key documented in src/tbm/config.ts; docs/tbm.md explicitly states the `tbm:` block in persisted settings is NOT consumed by the main agent unless the integration path is explicitly enabled by the running version (audit target).
- `memory:` — matches are mostly internal-URL protocol (memory://) and memory-toast UI; no obvious `memory:` config-section consumer found in the grep sample (needs deeper tracing).
- TBM references: src/tbm/*, src/tools/index.ts, src/config/settings-schema.ts, src/goals/tools/goal-tool.ts, src/modes/turn-budget.ts, src/slash-commands/builtin-registry.ts, prompts, docs.

---

# UNIT 0 — Re-verify (audit session start)

Re-run of the baseline before any changes. Recorded 2026-08-17.

## git status / log
- Branch main, up to date with origin/main. Same untracked set as first baseline: `.agents/`, `.claude/`, `SKILLS_MANIFEST.md`, `SNS-MYAGENT-DEEP-AUDIT-TASK.md`, `agent/`, `skills-lock.json`, plus audit WIP: `scripts/diag-model.ts`, `scripts/tbm-benchmark.ts`, `src/memory-backend/__tests__/`, `src/tbm/__tests__/tbm-audit.test.ts`, `test/telegram-audit.test.ts`, and `AUDIT-BASELINE.md`.
- HEAD unchanged: fddacf1.

## bun install
- Clean. postinstall downloads `snsagent-linux-x64` (111.93 MB) and applies pi-natives patch (`loader-state.js` already patched, skip). 303 installs across 329 packages, no changes.

## bun test (full repo, `bun test`)
- **769 pass, 2 skip, 54 fail, 4 errors** across 107 files (825 tests).
- All failures are in the untracked `agent/skills/` directory (media-use, hyperframes-*, faceless-explainer, general-video, pr-to-video, product-launch-video, talking-head-recut, caveman-*, node/rules, pi-planning-with-files, etc.). Not part of git, not part of core `src/`.
- The count drifted slightly from the first baseline (721/53 → 769/54) because `agent/skills/` content changed between sessions.

## bun test test src (core scope, package.json test script)
- **758 pass, 2 skip, 64 fail, 2 errors** — note: this scope still discovers some `agent/skills/` tests (they are imported/referenced through the skill-registry test graph), and it additionally surfaces timeouts in the audit-WIP memory-integration suite under parallel load (see below).

## Audit WIP test files — isolated runs (all pass in isolation)
- `src/memory-backend/__tests__/memory-integration.test.ts` → **14 pass** when run alone. Under `--parallel=4` in the full suite, several cases time out at 5000ms (e.g. `autoRetain off means agent_end stores nothing`, `beforeAgentStartPrompt ...`, `completion() through eval runtimes`). This is a test-isolation/resource-contention issue in the mnemopi/backend fixture, to be fixed in UNIT 1.
- `test/telegram-audit.test.ts` → **14 pass** (authorization boundary documented as GAP, file upload path, command surface, lifecycle).
- `src/tbm/__tests__/tbm-audit.test.ts` → **21 pass** (compressor semantic preservation, response cache, tombstoner, context pyramid, delta cache, lazy skills, dashboard).

## Notable baseline facts to carry forward
- `package.json` test script is `bun test --parallel=4 test src`; the full-suite `bun test` also sweeps `agent/`.
- Core runtime tests are green; only untracked `agent/skills` and the audit-WIP parallel-isolation failures show red in aggregate.
- `scripts/diag-model.ts` (12 lines) and `scripts/tbm-benchmark.ts` (123 lines) are WIP entry points to be reviewed/extended in UNIT 2.
