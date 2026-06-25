# PLAN-PHASE-3 — Fix + Polish

> Created: 2026-06-25 | Status: PLANNING

---

## Context

Phase 2 (Core Agent + Telegram) and Phase 2.5 (ARM64) are done. `snscoder` runs from source (`bun run src/cli/entry.ts`) but compiled binaries fail due to `pi_natives` native addon issue. README has several inaccurate claims.

## Goal

Make `snscoder` distributable as a working binary + fix all documentation inaccuracies.

---

## Task 1: Fix Binary Execution (Critical)

**Problem:** `bin/snscoder --version` fails with:
```
[Uncaught Exception] Error: Failed to load pi_natives native addon for linux-x64 (modern).
```

**Root cause:** `bun build --compile` bundles JS into single ELF but can't load `@oh-my-pi/pi-natives` napi-rs `.node` binary at runtime. The addon does filesystem probes for platform-specific `.node` files that don't exist inside the compiled binary.

**Options:**

| Option | Approach | Effort | Risk |
|--------|----------|--------|------|
| A | Skip `pi_natives` in compile — use JS fallbacks | Medium | High (many features depend on native: PtySession, Shell, astGrep, countTokens) |
| B | Bundle `.node` file alongside binary — load from `$SNSCODER_HOME/native/` | Low | Low (just path fix) |
| C | Ship `node_modules` alongside binary — run via `node bin/snscoder.js` | Low | Medium (bloat, defeats purpose of compile) |
| D | Patch pi_natives loader to check embedded binary path | Medium | Low (cleanest long-term) |

**Recommended: Option D** — Patch `loader-state.js` to check `process.argv[0]` (the compiled binary path) for embedded native addon, then fall back to normal probe.

**Subtasks:**
- [ ] 1a: Analyze `@oh-my-pi/pi-natives/native/loader-state.js` to understand probe logic
- [ ] 1b: Patch loader to support `PI_NATIVES_PATH` env var override
- [ ] 1c: Test binary with env var pointing to extracted `.node` file
- [ ] 1d: If D fails, fall back to Option B (ship `.node` alongside binary)
- [ ] 1e: Test binary on clean VPS (no node_modules)

---

## Task 2: Fix README Inaccuracies

**Issues found in audit:**

| # | Issue | Fix |
|---|-------|-----|
| 1 | Tool names wrong (`terminal` → `bash`, `file_read` → `read`, `file_write` → `write`) | Update tool table in README |
| 2 | "5 built-in tools" → actual 29 | Update count or list all 29 |
| 3 | Memory backends: claims Mnemosyne/Mem0/LCM → only mnemopi + hindsight + local exist | Correct backend list |
| 4 | "Cron scheduling: ✅" → not implemented | Remove or mark as planned |
| 5 | Tool count "74 tools" in research table → actual 29 builtin | Correct count |

**Subtasks:**
- [ ] 2a: Update tool names and count in README.md
- [ ] 2b: Update memory backends section
- [ ] 2c: Remove cron claim or mark as "planned"
- [ ] 2d: Sync docs/memory.md with actual backends

---

## Task 3: Commit + Update Release

After tasks 1-2 complete:

- [ ] 3a: Commit all changes
- [ ] 3b: Rebuild binaries if task 1 changes affect build
- [ ] 3c: Update GitHub Release v0.1.0 (or create v0.1.1 if binary fix is significant)
- [ ] 3d: Update PROGRESS.md and KANBAN.md

---

## Execution Order

```
Task 1 (binary fix) ──→ Task 2 (README) ──→ Task 3 (commit + release)
      │
      └── If blocked, skip to Task 2 first, come back later
```

## Success Criteria

- [ ] `bin/snscoder --version` prints `snscoder 0.1.0` without error
- [ ] README tool names match actual `builtin-names.ts`
- [ ] README memory backends match actual `resolve.ts`
- [ ] No false "✅" claims for unimplemented features
- [ ] Release updated with working binaries (or documented workaround)
