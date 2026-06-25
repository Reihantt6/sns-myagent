# SNS-MyAgent — Kanban Board

> **Last updated:** 2026-06-25 15:10 UTC

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

### Phase 1: Fork + Scaffold (2026-06-24, commit d1480eb)
- [x] Clone Pi Agent → rename to sns-myagent (1,282 src files)
- [x] Rebrand: package.json `@sns-myagent/cli`, bin `snscoder`, config dir `.sns-myagent/`
- [x] Basic CLI: `snscoder chat`, `snscoder setup` registered in `src/cli-commands.ts`
- [x] Config system: `src/config/` (loadConfig/getConfig/saveConfig, YAML, BYOK)
- [x] Terminal UI: `src/ui/` (colors.ts, banner.ts, spinner.ts, chat-prompt.ts, status-bar.ts)
- [x] Tech deps: chalk, picocolors, ora, boxen, gradient-string, cli-table3
- [x] install.sh rewritten (Bun-based)
- [x] bin/snscoder.js — npm CLI shim
- [x] install.ps1 — Windows PowerShell installer
- [x] scripts/fetch-binary.mjs — postinstall binary downloader
- [x] Docs audit: English-only sweep, factual sync (commit 45ed846)
- [x] GitHub Actions CI/CD (commit 5cf2bc0)
- [x] `--version` / `-v` flag (commit 11407f4)

### Phase 1.5: Binary + Cleanup (2026-06-25, commit c156e8c)
- [x] Prebuilt standalone binary `bin/snscoder` (Linux x64, ~92 MB ELF)
- [x] `bin/snscoder-linux-x64` alias + `bin/snscoder.js` source entry preserved
- [x] TS compile: 0 errors
- [x] Lockfile fixed (no duplicate `@oh-my-pi/*` entries)
- [x] Internal phase tracker moved out of public docs
- [x] Fabricated slash-commands/tools table removed from README
- [x] GitHub Actions: diagnostic + workflow scripts added
- [x] GitHub Release v0.1.0 published with 3 binary assets
- [x] Release notes: `RELEASE-NOTES-v0.1.0.md`

### Phase 2: Core Agent + Telegram (2026-06-25)
- [x] Telegram bot foundation (polling, message handler) — `src/adapters/telegram/bot.ts`
- [x] Chat adapter (Telegram → CLI entry) — `src/adapters/telegram/handler.ts`
- [x] Output formatting (Markdown → Telegram-safe HTML) — `src/adapters/telegram/format.ts`
- [x] Integration tests — `test/telegram.test.ts` (322 lines)
- [x] CLI entry wired — `src/cli/entry.ts`
- [x] README audit: 58 commands confirmed, 29 tools found, memory backends documented

### Phase 2.5: ARM64 + Termux (2026-06-25)
- [x] ARM64 cross-compile: `bin/snscoder-linux-arm64` (91 MB ELF aarch64)
- [x] Uploaded to GitHub Release v0.1.0 (4 assets total)
- [x] `install.sh` rewritten: multi-arch, Termux-aware, download prebuilt binary
- [x] Platform detection: Linux x64/ARM64, macOS, Windows (WSL)

### Phase 3: TBM Implementation (2026-06-25)
- [x] `src/tbm/config.ts` — TBM config schema + defaults
- [x] `src/tbm/context-delta.ts` — static/dynamic split, SHACL-like message hashing
- [x] `src/tbm/context-pyramid.ts` — 5 pyramid levels, auto-demotion
- [x] `src/tbm/lazy-skills.ts` — index-on-demand skill loading
- [x] `src/tbm/tool-compress.ts` — per-tool output budgets, reducers
- [x] `src/tbm/tombstone.ts` — old message → 10-line summary
- [x] `src/tbm/response-cache.ts` — exact + semantic (Jaccard) cache
- [x] `src/tbm/comm-modes.ts` — caveman/normal/verbose/auto
- [x] `src/tbm/dashboard.ts` — `/tokens` command, box-drawing UI
- [x] `src/tbm/index.ts` — TbmManager singleton, subsystem coordination
- [x] `/tokens` and `/mode` slash commands wired into builtin-registry.ts
- [x] All TBM modules compile clean (tsc --noEmit passes)

---

## 🔥 IN PROGRESS

_(nothing currently in progress)_

---

## 📋 BACKLOG

### Phase 3: Fix + Polish (next)
- [ ] Fix binary execution (pi_natives native addon issue)
- [ ] Correct README: tool names (`bash` not `terminal`, `read` not `file_read`)
- [ ] Correct README: memory backends (mnemopi + hindsight, not mnemosyne/mem0/LCM)
- [ ] Remove cron claim from README (not implemented)
- [ ] Add missing tool list to README (29 tools, not 5)

### Phase 4: Memory + Skills
- [ ] Implement cron scheduler (claimed but missing)
- [ ] Mnemosyne memory backend (claimed but missing)
- [ ] Mem0 memory backend (claimed but missing)
- [ ] LCM memory backend (claimed but missing)
- [ ] Telegram slash commands (/code, /review, /status, /help, /model)
- [ ] File upload/download via Telegram

### Phase 5: Multi-Agent + Advanced
- [ ] Multi-agent orchestrator
- [ ] Agent roles config (agents.yaml)
- [ ] Parallel task execution
- [ ] Multi-model ensemble (consensus, critic, best-of-N)
- [ ] Session DAG (fork/merge)
- [ ] Error handling, retry, timeout

### Phase 6: Polish + Publish
- [ ] npm publish (`@sns-myagent/cli`)
- [ ] Standalone binaries (macOS, Windows)
- [ ] Docker image (ghcr.io)
- [ ] E2E smoke test all platforms
- [ ] Docs final sync

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
