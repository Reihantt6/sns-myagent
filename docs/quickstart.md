# Quickstart

Get from zero to a working `snsagent` in about 5 minutes.

## 1. Install

Pick one path — the fastest is npm:

```bash
npm install -g @sns-myagent/cli
```

or the one-liner installer (Linux / macOS / WSL):

```bash
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```

or from source (the official path, and the only option on Android/Termux):

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts --version
```

Full per-platform details: [installation.md](./installation.md).

## 2. Verify

```bash
snsagent --version   # -> snsagent 0.3.10
snsagent --help
```

## 3. Start it

```bash
snsagent
```

First launch opens the **setup wizard**. Choose a provider or pick **BYOK** to enter a
custom Base URL + API key (Tab moves between fields, Enter connects, ↑↓ changes the API
type). Once connected, pick a model and you land in the interactive TUI.

> Shortcut: set a key in the environment and skip the wizard entirely:
> `export OPENAI_API_KEY="..."` (or `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`).

## 4. Chat

```text
> what files are in the current directory?
> create a TypeScript module that parses CSV files
> refactor src/utils/edit-mode.ts to use async/await
```

Type `/help` for the full command list, `/tokens` for the token dashboard, and
`/setup` to reconfigure providers anytime.

## 5. Where things live

| Thing | Location |
|---|---|
| Config | `~/.omp/agent/config.yml` (or `.sns-myagent/config.json` for the init flow) |
| Provider + models | `~/.omp/agent/models.yml` |
| Sessions | `~/.omp/agent/sessions/` |
| Memory (mnemopi) | `~/.omp/agent/mnemopi/` |

See [running.md](./running.md) for launch modes, providers, memory backends, and common
slash commands.

## Next steps

- [Installation guide](./installation.md) — every platform and method
- [Running guide](./running.md) — launch modes, providers, memory, TBM
- [Configuration](./configuration.md) — all settings
- [Termux (Android)](./termux.md) — run on a phone
