# Troubleshooting

## Check the installed version

```bash
snsagent --version
snsagent --help
```

Expected version for this release:

```text
snsagent 0.3.9
```

## `command not found: snsagent`

Check whether the package is installed globally:

```bash
npm ls -g --depth=0
command -v snsagent
```

Install it with:

```bash
npm install -g @sns-myagent/cli
```

If you used the shell installer, reload the shell so `~/.local/bin` is on PATH.

## Provider or model errors

Run `/setup` in the interactive agent, then verify the Base URL, API type, model ID, and credentials. For a hand-written setup, inspect `~/.omp/agent/models.yml` without printing secret values.

## No model is selected

Check the provider definitions and role assignment:

```text
/model
```

If orchestration is involved, verify `modelRoles.default` in `~/.omp/agent/config.yml`.

## Permission denied for a source-built binary

Only for a binary built from source:

```bash
chmod +x bin/snsagent-linux-x64
./bin/snsagent-linux-x64 --version
```

## Bun is missing

Bun is required for source execution and builds, but not for the normal npm install. Install Bun when using source mode:

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

## Memory database is locked

Stop snsagent before copying or repairing SQLite state. Do not delete journal files while another process is running. Check for active processes first:

```bash
pgrep -af snsagent
```

The interactive agent stores state below `~/.omp/agent`. The mnemopi database is below that directory's `memories/` tree.

## Telegram not responding

Check the adapter status and token source:

```bash
snsagent telegram status
```

For a service, verify `SNS_TELEGRAM_BOT_TOKEN` in `/etc/snsagent/secrets.env` and inspect:

```bash
sudo systemctl status snsagent
journalctl -u snsagent -e
```

## Build problems

```bash
bun install
bun run check
bun run build
```

If native optional dependencies fail during installation, retry with the repository's supported Bun version and inspect the first native-module error before removing files.

## Still stuck?

Open an issue at https://github.com/Reihantt6/sns-myagent/issues with the exact command, output, operating system, Node or Bun version, and a redacted configuration summary.