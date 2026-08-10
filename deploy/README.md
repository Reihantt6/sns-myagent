# deploy/

System deployment artifacts for sns-myagent. **Not committed to git** by default
(excluded via root `.gitignore`).

## Layout

```
deploy/
├── systemd/
│   ├── snsagent.service             # main daemon
│   ├── snsagent-restart.service     # one-shot restart
│   └── snsagent-restart.timer       # daily 04:00 trigger
├── cron/
│   ├── snsagent-watchdog            # every 5min: restart if dead
│   ├── nine-router-watchdog         # every 1min: 3-fail circuit-break
│   ├── snsagent-backup              # daily 02:30: rclone to gdrive
│   └── snsagent-logs                # weekly: prune old logs
├── install.sh                       # copy units + crons (no-enable by default)
└── secrets.env.example              # template for /etc/snsagent/secrets.env
```

## Install

```bash
# Build the binary first (from the repository root):
bun run build

# Stage files only (safe, no services started):
bash deploy/install.sh

# Stage AND enable:
bash deploy/install.sh --enable
```

`install.sh` copies the systemd units and cron jobs and creates
`/etc/snsagent/secrets.env` if it is missing. It does **not** enable or start
anything unless `--enable` is passed. Run it interactively — it is not
idempotent-safe for the cron files.

> **Note:** this is the daemon deployment path. It is separate from the
> interactive CLI (`snsagent` in a terminal) described in the root
> [README.md](../README.md). Use the daemon when you want snsagent running
> continuously on a server with the Telegram adapter. The systemd service
> starts the compiled binary; `SNS_TELEGRAM_BOT_TOKEN` makes it boot the
> Telegram bot polling.

## Secrets layout

`/etc/snsagent/secrets.env` (chmod 600) holds tokens:
```
SNS_TELEGRAM_BOT_TOKEN=...
SNS_TELEGRAM_CHAT_ID=...
```

`/etc/snsagent/nine-router.env` (optional, chmod 600):
```
NINE_ROUTER_KEY=sk-...
```

## What this does NOT do

- Does not enable services automatically (unless `--enable`)
- Does not write secrets (only the empty template)
- Does not modify `/root/.omp/` (assumes already configured)
- Does not pull/build binary (run `bun run build` first)

## Operations & troubleshooting

```bash
sudo systemctl start snsagent          # start the daemon
sudo systemctl restart snsagent        # restart after config changes
sudo systemctl status snsagent         # check status
journalctl -u snsagent -f              # follow logs
```

If the service fails to start:

```bash
sudo systemctl status snsagent
journalctl -u snsagent -e --no-pager
```

Common causes: missing `/etc/snsagent/secrets.env` (or an empty token), or
unset environment variables that the binary needs. The service reads secrets
from `/etc/snsagent/secrets.env`. If the Telegram bot does not respond, verify
the token there, restart the service, and check `journalctl -u snsagent`.

```bash
snsagent telegram status   # from the CLI: shows adapter + token state
```
