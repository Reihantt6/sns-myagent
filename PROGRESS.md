# SNS-MyAgent — Project Progress

> Auto-maintained. Last updated: 2026-06-25

## Overall Status

| Phase | Status | Target |
|-------|--------|--------|
| Phase 1: Fork + Scaffold | ✅ DONE | 2026-06-25 |
| Phase 2: Core Agent + Telegram | 🔧 IN PROGRESS | 2026-07-05 |
| Phase 3: Memory + Skills | ⏳ Not started | 2026-07-12 |
| Phase 4: Multi-Agent + Advanced | ⏳ Not started | TBD |

---

## Phase 1: Fork + Scaffold ✅

**Completed 2026-06-25** — Commits: `d1480eb` → `ea9e887`

- [x] Clone Pi Agent → rename to sns-myagent (1,282 src files)
- [x] Rebrand: package.json `@sns-myagent/cli`, bin `snscoder`, config dir `.sns-myagent/`
- [x] CLI: `snscoder chat`, `snscoder setup`, `--version` flag
- [x] Config system: loadConfig/getConfig/saveConfig, YAML, BYOK
- [x] Terminal UI: colors, banner, spinner, chat-prompt, status-bar
- [x] install.sh (Bun-based), install.ps1, bin/snscoder.js
- [x] GitHub Actions CI/CD (lint → build → test)
- [x] Docs: English-only, fabricated claims fixed, README cleaned

---

## Phase 2: Core Agent + Telegram 🔧

**In progress** — Target: 2026-07-05

### Research findings (2026-06-25)

| Task | Already exists? | Source | Work needed |
|------|----------------|--------|-------------|
| Provider integration | ✅ YES | `src/config/model-registry.ts`, `model-resolver.ts`, `@oh-my-pi/pi-ai` | Rebrand env vars in docs |
| Chat loop (streaming) | ✅ YES | `src/modes/interactive-mode.ts`, `@oh-my-pi/pi-agent-core` Agent | Extract from TUI for headless mode |
| Tool system | ✅ YES (74 tools) | `src/tools/read.ts`, `write.ts`, `bash.ts`, `search.ts`, `fetch.ts` | Zero — interface-based |
| Telegram bot | ❌ NO | No telegram lib, no telegram code | Build from scratch |
| Slash commands | ✅ YES | `src/slash-commands/builtin-registry.ts` | Create Telegram adapter |
| Multi-platform | ⚠️ Partial | Linux/macOS/Windows OK | Termux untested |

### Tasks

- [ ] Step 1: Telegram bot foundation (grammy lib, polling, message handler)
- [ ] Step 2: Chat adapter (Telegram → Agent headless mode)
- [ ] Step 3: Telegram commands (/code, /review, /status, /help, /model)
- [ ] Step 4: File upload/download via Telegram
- [ ] Step 5: Multi-platform testing (Termux)

---

## Phase 3: Memory + Skills ⏳

- [ ] SQLite memory backend (WAL mode)
- [ ] Memory types: prefs, context, lessons, patterns
- [ ] Auto-memory: extract → store → recall
- [ ] Skill loader: Markdown + TypeScript
- [ ] Context DSL: `.sns-myagent/context.yaml`
- [ ] Token Budget Manager (real implementation)

---

## Phase 4: Multi-Agent + Advanced ⏳

- [ ] Multi-agent orchestrator
- [ ] Agent roles config (agents.yaml)
- [ ] Parallel task execution
- [ ] Multi-model ensemble
- [ ] Session DAG (fork/merge)
- [ ] Error handling, retry, timeout

---

## Key Decisions Log

| # | Decision | Date |
|---|----------|------|
| 1 | Fork Pi Agent (not build from scratch) | 2026-06-24 |
| 2 | Bun runtime (not Node.js) | 2026-06-24 |
| 3 | Biome linter (not ESLint) | 2026-06-24 |
| 4 | mnemopi as memory backend | 2026-06-24 |
| 5 | Telegram polling first (not webhook) | 2026-06-24 |
| 6 | MVP = CLI + Telegram + Memory | 2026-06-24 |
| 7 | Multi-agent included in scope | 2026-06-24 |
