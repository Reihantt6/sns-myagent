# Changelog

All notable changes to SNS-MyAgent will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- Phase 1 scaffold complete: forked from Pi Agent, rebranded as `@sns-myagent/cli` with `snscoder` binary (commit `d1480eb`)
- GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`) with staged verify → install → typecheck → lint → build → diagnose jobs
- BYOK provider config system with `.sns-myagent/config.yaml` + env overrides
- Real source-derived inventory of 58 built-in slash commands and 70+ tools documented in README
- `docs/memory.md` covering mnemopi / mnemosyne / mem0 / lcm backends
- `docs/tbm.md` Token Budget Manager reference
- `SECURITY.md` vulnerability reporting + security model
- `CONTRIBUTING.md` dev setup + commit conventions
- `install.sh` / `install.ps1` cross-platform installers

### Changed
- Bumped `@oh-my-pi/*` packages from `16.1.15` → `16.1.18`
- `bin/snscoder` entrypoint now resolves to `bin/snscoder.js`
- README rewritten to remove fabricated slash-commands and tools tables — all claims now sourced from `src/`
- CHANGELOG Phase 2 entries flagged Telegram bot as not yet shipped (no `src/telegram/` files)

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