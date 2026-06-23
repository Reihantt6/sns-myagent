# Changelog

All notable changes to SNS-MyAgent will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Roadmap (approved 2026-06-23)

**Phase 1: Fork + Scaffold** (target: Week 1)
- Fork Pi Agent → rename to sns-myagent
- Rebrand: package name, CLI command (`snscoder`), config dir (`.sns-myagent`)
- GitHub Actions CI/CD (build, lint, test)
- Basic CLI structure (`snscoder chat`, `snscoder setup`, `snscoder --version`)
- Config system (config.yaml, env vars, BYOK provider setup)

**Phase 2: Core Agent + Telegram** (target: Week 2)
- Provider integration (OpenRouter, Groq, Ollama, custom)
- Chat loop (streaming, tool calling)
- Tool system (file_read, file_write, terminal, web_search)
- Telegram bot (polling mode, chat, file upload)
- Telegram commands (/code, /review, /status, /help, /model)
- Multi-platform testing (Linux, Windows, Termux)

**Phase 3: Memory + Skills** (target: Week 3)
- Memory backend: SQLite (local-first, zero-dep)
- Memory types: user preferences, project context, lesson learned, code patterns
- Auto-memory: extract from conversation, store, recall next session
- Skill loader: Markdown (SKILL.md) + TypeScript (executable)
- Context DSL: declarative context rules (.sns-myagent/context.yaml)
- Token Budget Manager (TBM) — unique feature

**Phase 4: Multi-Agent + Advanced** (target: Week 4)
- Multi-agent orchestrator (main → spawn sub-agents)
- Agent roles config (agents.yaml)
- Parallel task execution
- Multi-model ensemble (consensus, critic, best-of-N)
- Session DAG (fork/merge conversations)
- Error handling, retry, timeout

**Phase 5: Polish + Publish** (target: Week 4-5)
- npm publish (@sns-myagent/cli)
- Standalone binaries (Linux, macOS, Windows)
- Docker image (ghcr.io/reihantt6/sns-myagent)
- install.sh one-liner
- GitHub Release
- E2E smoke test all platforms

---

## [0.1.0] — 2026-06-23

### Added
- Project repository created (github.com/Reihantt6/sns-myagent, private)
- PRD v2.0 — Product Requirements Document (9 pages, competitive analysis)
- README.md — full project documentation with 5 install methods
- package.json — npm package config with `snscoder` bin
- install.sh — curl one-liner installer
- SECURITY.md — vulnerability reporting, security model
- CONTRIBUTING.md — dev setup, commit convention, code style
- CHANGELOG.md — this file
- docs/installation.md — detailed install guide + platform specs
- docs/configuration.md — full config reference
- docs/memory.md — 3 memory backends + Mem0 self-host guide
- docs/tbm.md — Token Budget Manager deep dive
- docs/troubleshooting.md — common issues + fixes
- docs/faq.md — detailed FAQ

### Status
- Phase: **Pre-development (Planning & Docs)**
- Next: Decision points from Bung → Phase 1 start
- Version: v0.1.0 = planning + docs complete
