# SNS-MyAgent — Kanban Board

> **Last updated:** 2026-06-26 21:05 UTC
> **Plan files:** `PLAN-PHASE-3.md` → `PLAN-PHASE-4.md` → `PLAN-PHASE-5.md` → `PLAN-PHASE-6.md` → `PLAN-OMP-CUSTOMIZATION.md`

---

## ✅ DONE

### Phase 0: Planning & Docs (2026-06-23)
- [x] PRD v2.0, README.md, package.json, install.sh, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md
- [x] docs/ (install, config, memory, tbm, troubleshooting, faq)
- [x] KANBAN.md, Skill: sns-myagent-development

### Phase 1: Fork + Scaffold (2026-06-24, commit d1480eb)
- [x] Clone Pi Agent → rename to sns-myagent (1,282 src files)
- [x] Rebrand: package.json, bin, config dir
- [x] CLI, Config system, Terminal UI, install scripts
- [x] GitHub Actions CI/CD

### Phase 1.5: Binary + Cleanup (2026-06-25, commit c156e8c)
- [x] Prebuilt binaries (x64, ARM64)
- [x] GitHub Release v0.1.0

### Phase 2: Core Agent + Telegram (2026-06-25)
- [x] Telegram bot (polling, handler, format, tests)
- [x] CLI entry wired
- [x] README audit

### Phase 2.5: ARM64 + Termux (2026-06-25)
- [x] ARM64 cross-compile, multi-arch install.sh

### Phase 2.8: TBM Implementation (2026-06-25)
- [x] 11 TBM modules (config, context-delta, pyramid, lazy-skills, tool-compress, tombstone, response-cache, comm-modes, dashboard, index)
- [x] `/tokens` + `/mode` slash commands wired
- [x] tsc --noEmit passes

### Phase 3: Fix + Polish (2026-06-26, commit 92110c4)
- [x] Binary verified working (`bin/snscoder --version`)
- [x] README audit: tool count 30 ✓, slash commands 58→61, memory backends 4→7
- [x] Removed duplicate `search` in tool table
- [x] Version badge synced to 0.2.0
- [x] .gitignore: added nested `sns-myagent/` dir
- [x] Added `launch` CLI command for full agent mode

### Phase 4: Memory + Cron + Telegram (2026-06-26)
- [x] Wire Telegram bridge (forwardToAgent + session cache) — commit b89123c
- [x] Telegram slash commands (/memory /cron /model /code /review) — commit b89123c
- [x] File upload/download via Telegram (document/photo/video/voice/audio) — commit 9208c21
- [x] Binary rebuilt v0.2.0 (113MB) — commit 2756988

---

## 🔥 IN PROGRESS
_(nothing currently in progress)_

---

## 📋 BACKLOG

### Phase 5: Multi-Agent + Advanced → `PLAN-PHASE-5.md`
- [ ] Multi-agent orchestrator
- [ ] Agent roles config (`agents.yaml`)
- [ ] Parallel task execution (DAG)
- [ ] Multi-model ensemble (consensus/critic/best-of-N)
- [ ] Session DAG (fork/merge)
- [ ] Error handling (retry, timeout, circuit breaker)

### Phase 6: Polish + Publish → `PLAN-PHASE-6.md`
- [ ] npm publish (`@sns-myagent/cli`)
- [ ] Multi-platform binaries (macOS x64/ARM64, Windows)
- [ ] Docker image (`ghcr.io/reihantt6/sns-myagent`)
- [ ] E2E smoke tests (all platforms)
- [ ] Docs final sync
- [ ] v1.0.0 release

### Phase 7: OMP Agent Integration → `PLAN-OMP-CUSTOMIZATION.md`
- [ ] Phase 1: Foundation & Analysis (inventory, config strategy)
- [ ] Phase 2: Config Injection & Agent Registry (OMP config, agent defs)
- [ ] Phase 3: Theme & Prompt Integration (themes, system prompts, slash commands)
- [ ] Phase 4: Tool & Backend Wiring (tools, memory backends, cron, telegram)
- [ ] Phase 5: TBM & Advanced Features (TBM, session DAG, subagent delegation)
- [ ] Phase 6: Binary & Distribution (binary fix, install script, docs)
- [ ] Phase 7: Polish & E2E Testing (full scenarios, performance, edge cases)
- [ ] Phase 8: Publish & Maintain (release, maintenance, marketplace)

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
| 1 | Package manager | Bun (canonical) | ✅ Decided |
| 2 | Skill language | TS + MD | ✅ Decided |
| 3 | Telegram mode | polling first | ✅ Done |
| 4 | MVP scope | core + TG + memory | ✅ Done |
| 5 | Multi-agent v1 | include (Phase 5) | ✅ Decided |
| 6 | Rebrand depth | CLI + config + UI | ✅ Done |
| 7 | Binary fix | pi_natives bundling | ⏳ Phase 3 |
