# Upstream Lineage & Dependency Drift

## Lineage

SNS-MyAgent (`@sns-myagent/cli`, v0.3.9) is a customization of [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) ("omp"). It depends on the upstream `@oh-my-pi/*` packages and layers a custom CLI, Telegram adapter, the `src/tbm/` token-budget module, and an expanded memory-backend abstraction on top.

| Dimension | SNS status | Notes |
|---|---|---|
| agent loop | adapted | relies on `@oh-my-pi/pi-agent-core` + `pi-ai` |
| tool execution | adapted | approval policy inherited; Telegram bridge uses `autoApprove: true` |
| approval/security | adapted | see `docs/security-model.md` |
| context handling / compaction | adapted | compaction lives in `agent-session.ts` |
| memory | extended | mnemopi/hindsight/mem0/lcm/mnemosyne/local/off backend abstraction |
| subagents | adapted | `src/task/`, `src/agents/` |
| provider support | inherited | `@oh-my-pi/pi-catalog` / `pi-ai` |
| MCP | adapted | `src/mcp/` |
| browser | inherited/adapted | puppeteer sandbox `~/.omp/puppeteer` |
| LSP/DAP | inherited | `@oh-my-pi/*` + `src/lsp`, `src/dap` |
| Telegram | **SNS-only** | no upstream equivalent (upstream issue #436 asks for remote control) |
| TUI | inherited | `@oh-my-pi/pi-tui` + `src/tui` |
| session persistence | adapted | `src/session/` |

Telegram is the clearest SNS-only surface: upstream oh-my-pi has an open request for remote control (#436) rather than a shipped adapter.

## Dependency drift

| Package | SNS (lockfile) | Upstream latest | Status |
|---|---|---|---|
| `@oh-my-pi/pi-agent-core` | 16.1.18 | 17.3.5 | behind (major) |
| `@oh-my-pi/pi-ai` | 16.1.18 | 17.3.5 | behind (major) |
| `@oh-my-pi/pi-mnemopi` | 16.1.18 | 17.3.5 | behind (major) |
| `@oh-my-pi/pi-natives` | 16.1.18 | 17.3.5 | behind (major) |
| `@oh-my-pi/pi-tui` | 16.1.18 | 17.3.5 | behind (major) |
| `@oh-my-pi/pi-catalog`, `pi-utils`, `pi-wire`, `hashline`, `omp-stats`, `snapcompact` | 16.1.18 | 17.3.5 | behind (major) |
| `@sns-myagent/*` scoped deps | none | - | the project itself is `@sns-myagent/cli`; no scoped deps exist |

`package.json` declares `^16.1.18` for every `@oh-my-pi/*` package, which is intentionally capped below v17. Upgrading to the v17 line is a **major** change and must not be merged blindly: it would touch the agent core, the mnemopi embeddings stack, and the compiled-native loader that SNS patches (see below).

## Custom postinstall

`package.json` `postinstall` runs two steps:

1. `scripts/fetch-binary.mjs` - downloads the prebuilt `snsagent-<platform>` binary (~112 MB) from the latest GitHub release of `Reihantt6/sns-myagent` into `bin/`, with a musl fallback on Linux. Failure is non-fatal (warns and exits 0) so `npm install` never breaks.
2. `scripts/apply-pi-natives-patch.js` - applies `patches/pi-natives-js-only-fallback.patch` to `@oh-my-pi/pi-natives/native/loader-state.js`, converting an unconditional `throw` into a conditional re-throw so a compiled Bun binary (no embedded native addon) starts in JS-only mode instead of crashing. Idempotent.

## Backport recommendation

| Upstream change | SNS status | Impact | Action |
|---|---|---|---|
| v17.x package line (17.3.5) | behind (16.1.18) | high | evaluate after a compat spike; do not blind-merge |
| remote-control / Telegram (#436) | SNS has its own adapter | low | ignore upstream (SNS diverged intentionally) |
| hindsight memory | present (adapted) | low | monitor |
| mnemopi embeddings | present (adapted + patched natives) | medium | re-validate patch against v17 before upgrade |
