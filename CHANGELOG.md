# Changelog

All notable changes to SNS-MyAgent will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Roadmap

**Phase 1: Fork + Scaffold** — ✅ Done (commit `d1480eb`)
- Fork Pi Agent → rename to sns-myagent
- Rebrand: package name (`@sns-myagent/cli`), CLI command (`snscoder`), config dir (`.sns-myagent`)
- GitHub Actions CI/CD (build, lint, test)
- Basic CLI structure (`snscoder chat`, `snscoder setup`, `snscoder --version`)
- Config system (config.yaml, env vars, BYOK provider setup)

**Phase 2: Core Agent + Telegram** — In progress
- Provider integration (OpenAI, Anthropic, Ollama, OpenRouter, custom)
- Chat loop (streaming, tool calling)
- Tool system — see [`src/tools/`](src/tools/) for the full 70+ tool inventory. Headline tools: `bash` (51741B), `write`, `fetch`, `search`, `gh`, `browser`, `ast-edit`, `tts`, `eval`, `debug`, `todo`, `read`
- Telegram bot (polling mode, chat, file upload) — *not yet present in `src/`; planned*
- Telegram commands (`/code`, `/review`, `/status`, `/help`, `/model`) — *planned*
- Multi-platform testing (Linux, Windows, Termux)

**Phase 3: Memory + Skills** — Pending
- Memory backend: SQLite (local-first, zero-dep) — already shipped via mnemopi
- Memory types: user preferences, project context, lesson learned, code patterns
- Auto-memory: extract from conversation, store, recall next session
- Skill loader: Markdown (SKILL.md) + TypeScript (executable)
- Context DSL: declarative context rules (`.sns-myagent/context.yaml`)
- Token Budget Manager (TBM) — already shipped (60-80% input token savings)

**Phase 4: Multi-Agent + Advanced** — Pending
- Multi-agent orchestrator (main → spawn sub-agents)
- Agent roles config (`agents.yaml`)
- Parallel task execution
- Multi-model ensemble (consensus, critic, best-of-N)
- Session DAG (fork/merge conversations)
- Error handling, retry, timeout

**Phase 5: Polish + Publish** — Pending
- npm publish (`@sns-myagent/cli`)
- Standalone binaries (Linux, macOS, Windows)
- Docker image (`ghcr.io/reihantt6/sns-myagent`)
- `install.sh` one-liner — already shipped
- GitHub Release
- E2E smoke test all platforms

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
- Phase: **Phase 1 done, Phase 2 in progress**
- Version: v0.1.0 = scaffold + docs complete, core agent landing