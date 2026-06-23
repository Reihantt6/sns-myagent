# SNS-MyAgent — Kanban Board

> **Last updated:** 2026-06-23

---

## ✅ DONE

### Phase 0: Planning & Docs (2026-06-23)
- [x] PRD v2.0 — 9 pages, competitive analysis, architecture, features
- [x] README.md — 5 install methods, specs table, full docs
- [x] package.json — npm config, `snscoder` bin
- [x] install.sh — curl one-liner installer
- [x] SECURITY.md — vulnerability reporting, security model
- [x] CONTRIBUTING.md — dev setup, commit convention, code style
- [x] CHANGELOG.md — v0.1.0 + full roadmap
- [x] docs/installation.md — detailed install + platform specs
- [x] docs/configuration.md — full config reference
- [x] docs/memory.md — 3 backends + Mem0 self-host guide
- [x] docs/tbm.md — Token Budget Manager deep dive
- [x] docs/troubleshooting.md — common issues + fixes
- [x] docs/faq.md — detailed FAQ
- [x] Project Timeline — 6 phases, target dates
- [x] KANBAN.md — this file
- [x] Skill: sns-myagent-development — full project context

---

## 📋 BACKLOG (Phase 1 — Fork + Scaffold)

- [ ] Clone Pi Agent → rename to sns-myagent
- [ ] Rebrand: package.json name, CLI entry, config dir
- [ ] GitHub Actions CI/CD (build, lint, test)
- [ ] Basic CLI: `snscoder chat`, `snscoder setup`, `snscoder --version`
- [ ] Config system: config.yaml loader, env vars, BYOK

**Target:** 2026-06-28 | **Status:** ⏳ Pending decision points

---

## 📋 BACKLOG (Phase 2 — Core Agent + Telegram)

- [ ] Provider integration (OpenRouter, Groq, Ollama, custom)
- [ ] Chat loop (streaming, tool calling)
- [ ] Tool system (file_read, file_write, terminal, web_search)
- [ ] Telegram bot (polling, chat, file upload)
- [ ] Telegram commands (/code, /review, /status, /help, /model)
- [ ] Multi-platform test (Linux, Windows, Termux)

**Target:** 2026-07-05 | **Status:** ⏳ Not started

---

## 📋 BACKLOG (Phase 3 — Memory + Skills)

- [ ] SQLite memory backend (WAL mode, concurrent access)
- [ ] Memory types: prefs, context, lessons, patterns
- [ ] Auto-memory: extract → store → recall
- [ ] Skill loader: Markdown + TypeScript
- [ ] Context DSL: `.sns-myagent/context.yaml`
- [ ] Token Budget Manager (TBM)

**Target:** 2026-07-12 | **Status:** ⏳ Not started

---

## 📋 BACKLOG (Phase 4 — Multi-Agent + Advanced)

- [ ] Multi-agent orchestrator
- [ ] Agent roles config (agents.yaml)
- [ ] Parallel task execution
- [ ] Multi-model ensemble (consensus, critic, best-of-N)
- [ ] Session DAG (fork/merge)
- [ ] Error handling, retry, timeout

**Target:** 2026-07-19 | **Status:** ⏳ Not started

---

## 📋 BACKLOG (Phase 5 — Polish + Publish)

- [ ] npm publish (`@sns-myagent/cli`)
- [ ] Standalone binaries (Linux, macOS, Windows)
- [ ] Docker image (ghcr.io)
- [ ] install.sh one-liner
- [ ] GitHub Release
- [ ] E2E smoke test all platforms
- [ ] Docs final sync

**Target:** 2026-07-21 | **Status:** ⏳ Not started

---

## 🔮 POST-MVP

- [ ] Agent-as-a-Service (HTTP/gRPC)
- [ ] Visual Regression (Playwright)
- [ ] Policy-as-Code (OPA)
- [ ] Observability (OpenTelemetry)
- [ ] Skills marketplace

---

## ❓ BLOCKED / DECISION NEEDED

| # | Question | Recommended | Status |
|---|----------|-------------|--------|
| 1 | Package manager | npm | ⏳ Awaiting Bung |
| 2 | Skill language | TS + MD | ⏳ Awaiting Bung |
| 3 | Telegram mode | polling first | ⏳ Awaiting Bung |
| 4 | MVP scope | core + TG + memory | ⏳ Awaiting Bung |
| 5 | Multi-agent v1 | include | ⏳ Awaiting Bung |
| 6 | Rebrand depth | CLI + config | ⏳ Awaiting Bung |
