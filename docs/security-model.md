# Security Model

This page describes how snsagent protects your machine while running tools on your behalf.

## How tool execution is gated

The agent executes tools (bash, edit/write, browser, ssh, MCP, and more) behind an approval policy:

- **Default mode is `always-ask`.** Read-only tools auto-approve; write and exec tools prompt for confirmation before running.
- **Auto-approve ("yolo") is opt-in.** Enable it explicitly with `--approval-mode yolo` / `--yolo` or `tools.approvalMode: yolo` in config. Subagents run headless behind the parent-task approval boundary.
- **The Telegram adapter** also honors an allowlist gate (see below).

Memory is scoped per-project (`mnemopi.scoping`), so each project's memory stays isolated. No secrets are committed to the repository (`.env*` and `.sns-myagent/` are gitignored).

## Security features by surface

| Surface | Protection |
|---|---|
| **Approval policy** | Read-only tools auto-approve; write/exec tools prompt. Default `always-ask`, opt-in yolo |
| **bash** | Approval policy + `clampTimeout` |
| **eval (py/js/jl/rb)** | Per-runtime environment allowlist |
| **write/edit** | Approval policy + path-escape guards in `src/tools/write.ts` |
| **read** | Approval policy + `resolveReadPath` rejects relative `../` escape |
| **ssh** | Approval + ssh-control directory |
| **browser (puppeteer)** | Sandbox directory `~/.omp/puppeteer` |
| **Telegram** | Opt-in `SNS_TELEGRAM_ALLOWED_USERS` numeric allowlist |
| **MCP** | User-configured servers; server instructions flagged as unverified |
| **plugins** | `~/.omp/plugins` + npm install; supply-chain trust is on the user |
| **cron** | Persistent jobs via settings |
| **goals** | `src/goals/runtime.ts` token budget |
| **subagents** | `src/task/executor.ts` budget + spawn allowlist |
| **secrets** | AuthStorage / api-key resolver; never logged |
| **memory** | Per-project scoping |
| **GitHub** | Read-only via gh CLI / cache |

## Telegram authorization

The Telegram bridge is a network-visible surface. To keep it safe:

1. Set `SNS_TELEGRAM_ALLOWED_USERS` to your numeric Telegram user id(s).
2. Only listed user ids (and group chats they author) are served; everyone else is rejected before the agent is consulted.
3. When it is unset, a warning is logged and the bot serves any sender.

> **Warning**: keep `SNS_TELEGRAM_ALLOWED_USERS` set. A deployment without it is an unauthenticated remote-execution surface.

Telegram sessions run tools with `autoApprove: true`, so the allowlist narrows *who* can talk to the agent, not *what* actions are approved. Review this boundary before exposing a bot on a shared network.

## Secrets handling

- API keys and tokens are never logged. Log sites for tokens and keys print status or paths, never values.
- Keep keys in environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ...) or git-ignored local config. Never commit real keys.

## Observability

Structured `logger.debug/warn` calls exist throughout `src/`, including auth-gate logs (`userId`, `chatId`) for the Telegram bridge.

## File paths that matter

| Concern | Where to look |
|---|---|
| Read/write path guards | `src/tools/write.ts`, `src/tools/read.ts` |
| Approval policy | `src/config/settings-schema.ts` (`tools.approvalMode`) |
| Telegram allowlist | `src/adapters/telegram/handler.ts` |
| Subagent budget | `src/task/executor.ts` |
| Goal token budget | `src/goals/runtime.ts` |
