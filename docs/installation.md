# Installation Guide

snsagent v0.3.9 is available from npm and the GitHub v0.3.9 release.

## Recommended install with npm

Requires Node.js 18 or newer.

```bash
npm install -g @sns-myagent/cli
snsagent --version
```

Expected output:

```text
snsagent 0.3.9
```

The npm postinstall script downloads the matching binary from the latest GitHub release. If the binary download is unavailable, npm still completes and you can retry with:

```bash
npm rebuild @sns-myagent/cli
```

## One-line installer

On Linux, macOS, WSL, and supported Termux environments:

```bash
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```

The installer downloads the latest `snsagent` release asset when one is available. It falls back to a source build with Bun when needed, installs to `~/.local/bin` by default, and prints the PATH command if your shell needs to be reloaded.

## Windows PowerShell

Requires Node.js 18 or newer.

```powershell
irm https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex
```

The script installs `@sns-myagent/cli` with npm and verifies `snsagent --version`. Pass `-UseBun` when you already have Bun and want to use the Bun installer path.

## Install with Bun

```bash
bun add -g @sns-myagent/cli
snsagent --version
```

For a one-off run without a global install, use the package name:

```bash
bunx @sns-myagent/cli --version
```

## Run from source

Requires Bun 1.3.14 or newer and Git.

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts --version
```

Build the standalone Linux x64 binary:

```bash
bun run build
./bin/snsagent-linux-x64 --version
```

`bun run build` produces `bin/snsagent-linux-x64` and copies it to `bin/snsagent`. Generated binaries are release artifacts and are not required for normal source development.

## First run

Start the interactive agent:

```bash
snsagent
```

Use `/setup` to configure a provider, or configure a provider in `~/.omp/agent/models.yml`. The setup flow accepts a Base URL, API key when required, API type, and model choice.

The first step of the setup wizard collects the provider details (Tab moves between fields, Enter connects):

![Provider setup wizard](screenshots/setup-wizard.png)

> Note: the screenshot uses a fallback font. In a terminal with a Nerd Font installed, the status bar and icons render with their intended glyphs.

## Verify an install

```bash
snsagent --version
snsagent --help
```

## Uninstall

For npm:

```bash
npm uninstall -g @sns-myagent/cli
```

For Bun:

```bash
bun remove -g @sns-myagent/cli
```

Runtime settings and sessions are separate from the package. See [configuration.md](configuration.md) before removing `~/.omp/agent` or `.sns-myagent`.