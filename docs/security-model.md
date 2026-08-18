# Security Model

This page records the verified security posture of SNS-MyAgent as of the deep audit.
Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO. Findings are evidence-based
(traced to source), not inferred from docs.

## Executive posture

- The agent executes tools (bash, edit/write, browser, ssh, MCP, etc.) behind an
  approval policy. The default mode is `always-ask` (read-only tools auto-approve;
  write/exec tools prompt); auto-approve ("yolo") is opt-in via CLI flags
  (`--approval-mode yolo` / `--yolo`) or config. **The Telegram adapter was an
  exception**: it created agent sessions with `autoApprove: true` and no user
  allowlist (see below), which is now mitigated with an opt-in allowlist.
- Memory is scoped per-project (`mnemopi.scoping`) and the cross-project SQLite
  handle-sharing bug found during the audit has been fixed.
- No secrets are committed to the repository (`.env*` and `.sns-myagent/` are
  gitignored; the audit never read them).

## Attack surface analysis

| Surface | Existing control | Missing control | Severity | Status |
|---|---|---|---|---|
| Telegram | opt-in `SNS_TELEGRAM_ALLOWED_USERS` allowlist (added this audit); deny-by-default when set | allowlist is **off by default**; group-chat membership is not checked | CRITICAL when unset | MITIGATED (opt-in) |
| Telegram bridge | — | `autoApprove: true` runs tools without per-action approval; `userId` is discarded (CLI hardcodes `"telegram"`) | HIGH | DOCUMENTED (allowlist gates entry) |
| bash | approval policy + `clampTimeout` | — | MEDIUM | INHERITED |
| eval (py/js/jl/rb) | per-runtime env allowlist | — | MEDIUM | INHERITED |
| write/edit | approval policy; path-escape guards in `src/tools/write.ts` | — | MEDIUM | INHERITED |
| read | approval policy; `resolveReadPath` rejects relative `../` escape (UNIT Y2) | — | MEDIUM | FIXED (guard) |
| ssh | approval + ssh-control dir | — | MEDIUM | INHERITED |
| browser (puppeteer) | sandbox dir `~/.omp/puppeteer` | — | MEDIUM | INHERITED |
| MCP | user-configured servers; instructions flagged as unverified | server-supply-chain trust is on the user | MEDIUM | DOCUMENTED |
| plugins | `~/.omp/plugins` + npm install | supply-chain trust is on the user | MEDIUM | DOCUMENTED |
| cron | persistent jobs via settings | no per-job allowlist of tools | MEDIUM | INHERITED |
| goals | `src/goals/runtime.ts` token budget | goal text can instruct arbitrary tools (prompt injection) | MEDIUM | DOCUMENTED |
| subagents | `src/task/executor.ts` budget + spawn allowlist | privilege propagation to subagents | MEDIUM | DOCUMENTED |
| secrets | AuthStorage / api-key resolver; never logged | — | LOW | INHERITED |
| memory | per-project scoping; scope-isolation bug fixed | mem0/lcm/mnemosyne/local have no auto-recall (no leak, but also no injection) | LOW | FIXED (scoping) |
| GitHub | read-only via gh CLI / cache | — | LOW | INHERITED |

## Findings (with evidence)

### CRITICAL — Telegram had no authorization boundary (now opt-in mitigated)

- `src/adapters/telegram/handler.ts` parses `userId` (`msg.from?.id`) but no
  caller enforced it.
- `src/cli/index.ts` and `src/cli/entry.ts` adapt the bridge with a constant
  `"telegram"` as the user id — the real Telegram identity never reaches the
  bridge.
- `src/adapters/telegram/bridge.ts` creates sessions with `autoApprove: true`.

Any user who could message the bot could drive arbitrary agent actions on the
host. Fix (this audit): an opt-in `SNS_TELEGRAM_ALLOWED_USERS` allowlist checked
in `TelegramBot#onMessage` before any agent forwarding, with a startup warning
when it is unset. **Operators are strongly advised to set it.**

### HIGH — Telegram tools run with auto-approve

Even with the allowlist, an authorized Telegram user's messages run tools with
`autoApprove: true` (no per-action confirmation). The allowlist narrows *who*,
not *what*. Remaining risk recorded, not hidden.

### MEDIUM (fixed) — default approval mode was `yolo` (auto-approve)

The `tools.approvalMode` schema default was `yolo`, so a fresh config
auto-approved every tool call (including critical bash patterns like `rm -rf /`)
with no explicit opt-in — contradicting the doc claim that yolo is opt-in.
Fixed (UNIT Y1): the schema default is now `always-ask` and the extension
wrapper's settings fallback matches it. `yolo` remains available as an explicit
opt-in (`--yolo` / `--approval-mode yolo` / `tools.approvalMode: yolo` in config)
and subagents still run headless in yolo mode behind the parent-task approval
boundary (`src/task/executor.ts`).

### MEDIUM (fixed) — read-path traversal was not workspace-guarded

`resolveReadPath` resolved `../` relative paths above `cwd`, so a prompt-injected
read could reach files outside the workspace (proven: `resolveReadPath("../outside/secret.txt", ws)`
read `secret.txt`). Fixed (UNIT Y2): `resolveReadPath` now rejects a RELATIVE
path that escapes `cwd` with a `ToolError`; absolute and `~`-expanded paths
remain readable as explicit user intent. `resolveToCwd` (used by bash/debug,
where escaping is legitimate) is intentionally unchanged.

### HIGH (fixed) — memory cross-project scope leakage

`mem0`/`lcm`/`mnemosyne` kept a module-level `let db` singleton that ignored
`agentDir`, so a second project in one process shared the first project's
SQLite. Fixed by keying handles by resolved path.

### MEDIUM — lcm `clear()` corrupted the FTS index

`lcm` lacked the FTS5 `AFTER UPDATE` trigger; its post-save `UPDATE` made
`clear()` throw `database disk image is malformed`, leaving "deleted" deltas
searchable. Fixed by adding the update trigger.

### INFO — dead code

- `src/tbm/` (`TbmManager`) has zero runtime consumers (see `docs/tbm.md`).
- `mnemosyneBackend` is unreachable: `memory.backend=mnemosyne` is migrated to
  `mnemopi` in `Settings.#migrateRawSettings`, yet `mnemosyne` remains a
  selectable enum value in the settings schema (misleading UI).

## Observability

Structured `logger.debug/warn` calls exist (217 in `src/`), and this audit added
structured auth-gate logs (`userId`, `chatId`). The core loop does not yet attach
session/turn/tool-call IDs to every log line; that is a recorded improvement, not
a regression. No secrets are logged (verified: token/API-key log sites log status
or paths, never values).
