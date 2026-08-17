# Telegram

## Purpose

Run snsagent as a Telegram bot: each message drives a real agent session
(message → handler → session → agent → model → tool → response → Telegram). The
adapter lives in `src/adapters/telegram/` and is built on [grammY](https://grammy.dev/).

## How it works

- The bot polls Telegram when `SNS_TELEGRAM_BOT_TOKEN` is set (auto-boot), or when
  started explicitly with `snsagent telegram`.
- Each chat maps to an agent session; incoming text becomes a user turn, and the
  agent's reply is sent back through the bot.
- Eleven slash commands are wired: `/start /help /chat /reset /status /memory /cron
  /model /code /review /task`. File upload/download is supported.

## Configuration

```bash
export SNS_TELEGRAM_BOT_TOKEN="your-bot-token-here"
export SNS_TELEGRAM_ALLOWED_USERS="123456789"   # your numeric Telegram user id
export SNS_TELEGRAM_AUTOSTART=0                 # optional: disable auto-boot
snsagent
```

## Real example

```text
You (Telegram):  what files changed since yesterday?
Bot:             Ran `git diff` … 3 files changed.
You (Telegram):  /status
Bot:             Session: active · model: claude-sonnet · backend: mnemopi
```

## Expected behavior

- When `SNS_TELEGRAM_ALLOWED_USERS` is set, only the listed user ids (and group chats
  they author) are served; anyone else is rejected **before** the agent is consulted.
- When it is unset, a warning is logged and the bot serves any sender.

## Failure behavior

- No token → the adapter does not start (or `snsagent telegram` errors).
- Network/polling errors are retried by grammY; transient failures do not kill the
  agent process.

## Limitations (authorization boundary)

- The allowlist is **opt-in** (off by default). A deployment that forgets to set it is
  an unauthenticated remote-execution surface.
- Sessions are created with `autoApprove: true` — the allowlist narrows *who* can talk
  to the agent, **not** *what* actions are auto-approved.
- Group-chat handling is accepted but the per-message authorization is coarse; review
  the boundary in [docs/security-model.md](./security-model.md) before exposing a bot.

## Testing status

```bash
bun test test/telegram-audit.test.ts   # handler + auth-gate coverage
bun test test/telegram.test.ts
```

The audit test covers the message → handler → session path and the
`SNS_TELEGRAM_ALLOWED_USERS` authorization gate (rejection of unlisted users, warning
when unset).
