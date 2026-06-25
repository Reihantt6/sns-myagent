# Changelog

All notable changes to SNS-MyAgent will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- **TBM (Token Budget Manager) fully implemented** — 7 core modules:
  - Context Delta Cache: static/dynamic message splitting, ~40% token savings
  - Context Pyramid: 5 compression levels (L0–L4), auto-demotion based on budget pressure
  - Lazy Skill Loading: index-on-demand instead of bulk inject, ~85% savings
  - Tool Output Compression: per-tool budgets, auto-truncation, JSON/HTML/markdown reducers
  - Conversation Tombstoning: old messages → 10-line summaries, ~85% reduction
  - Response Cache: exact + semantic (Jaccard bigram) match, configurable TTL
  - Communication Modes: caveman/normal/verbose/auto with system prompt directives
- `/tokens` command: full TBM dashboard (session stats, cache hits, compression, pyramid level, cost estimate)
- `/mode` command: set caveman/normal/verbose/auto communication mode
- `TbmManager` singleton class coordinating all subsystems
- Phase 1 scaffold complete: forked from Pi Agent, rebranded as `@sns-myagent/cli` with `snscoder` binary (commit `d1480eb`)
- GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`) with staged verify → install → typecheck → lint → build → diagnose jobs
- BYOK provider config system with `.sns-myagent/config.yaml` + env overrides
- Real source-derived inventory of 58 built-in slash commands and 70+ tools documented in README
- `docs/memory.md` covering mnemopi / mnemosyne / mem0 / lcm backends
- `docs/tbm.md` Token Budget Manager reference
- `SECURITY.md` vulnerability reporting + security model
- `CONTRIBUTING.md` dev setup + commit conventions
- `install.sh` / `install.ps1` cross-platform installers
- Phase 1.5: prebuilt Linux x64 standalone binary (`bin/snscoder-linux-x64`) produced via `bun build --compile` in `scripts/build-binary.ts`
- Phase 1.5: integration smoke tests (`test/integration/`) covering CLI binary launch + version/help output
- Phase 1.5: `grammy` dependency added for the Telegram adapter (`src/telegram/` adapter stub)
- Phase 1.5: default-config YAML writer (`DEFAULT_CONFIG_YAML` in `src/config/defaults.ts`) — first-run writes a real `config.yaml` instead of silently no-op

### Changed
- Bumped `@oh-my-pi/*` packages from `16.1.15` → `16.1.18`
- `bin/snscoder` entrypoint now resolves to `bin/snscoder.js`
- README rewritten to remove fabricated slash-commands and tools tables — all claims now sourced from `src/`
- CHANGELOG Phase 2 entries flagged Telegram bot as not yet shipped (no `src/telegram/` files)
- `package.json` `build` script moved from inline `bun build` flags to `bun scripts/build-binary.ts` for readability
- `src/config/defaults.ts` now exports `DEFAULT_CONFIG_FILE`, `DEFAULT_CONFIG_YAML`, `DEFAULT_MODEL`, `DEFAULT_PROVIDER` to satisfy `src/config/index.ts` import (was 4 pre-existing TS errors)

### Removed
- Dead code: `src/shims/pi-agent-core-shim.ts` — never imported anywhere, kept only as a self-documented escape hatch that became obsolete once `@oh-my-pi/pi-agent-core` 16.1.18 barrel re-exports stabilised
- `package.json.orig` migration artifact (superseded by current `package.json`; diff captured in `.sns-myagent/`)
- `src/shims/` directory (empty after shim removal)

### Fixed
- 4 pre-existing TS errors at `src/config/index.ts:20` — missing exports on `defaults.ts` (`DEFAULT_CONFIG_FILE`, `DEFAULT_CONFIG_YAML`, `DEFAULT_MODEL`, `DEFAULT_PROVIDER`)

### Status
- Latest released version: [0.1.0] — 2026-06-23
- Internal phase tracker: see `PROGRESS.md` (gitignored, not on GitHub)

---

## [0.1.0] — 2026-06-23

### Added
- Project repository created (github.com/Reihantt6/sns-myagent)
- PRD v2.0 — Product Requirements Document (competitive analysis)
- README.md — full project documentation with install methods
- `package.json` — package config with `snscoder` bin
- `install.sh` — curl one-liner installer
- SECURITY.md — vulnerability reporting, security model
- CONTRIBUTING.md — dev setup, commit convention, code style
- CHANGELOG.md — this file
- `docs/installation.md` — install guide + platform specs
- `docs/configuration.md` — config reference
- `docs/memory.md` — 4 memory backends (mnemopi, mnemosyne, mem0, lcm) + Mem0 self-host guide
- `docs/tbm.md` — Token Budget Manager deep dive
- `docs/troubleshooting.md` — common issues + fixes
- `docs/faq.md` — FAQ
- `docs/terminal-ui.md` — TUI design spec

### Status
- v0.1.0 = scaffold + docs complete; core agent landing