# MCP (Model Context Protocol)

## Purpose

Connect external tool servers to the agent — filesystem, GitHub, databases,
web search — over the Model Context Protocol, so the model can call tools the
agent doesn't ship itself.

## How it works

- Config lives in per-project `.mcp.json` plus user-level sources, loaded via
  the capability system (`src/mcp/config.ts` → `loadCapability`).
- Servers run over two transports: **stdio** (`command`) and **HTTP**
  (`url`); `src/mcp/json-rpc.ts` provides a lightweight HTTP JSON-RPC path and
  SSE parsing.
- OAuth support: `src/mcp/oauth-discovery.ts`, `oauth-flow.ts`,
  `oauth-credentials.ts`, plus Smithery auth (`smithery-auth.ts`).
- Tool bridge + cache expose MCP tools to the agent loop
  (`src/mcp/tool-bridge.ts`, `tool-cache.ts`).
- Exa/browser filters can exclude servers whose functionality the builtin
  tools already provide.

## Configuration

Servers are added through conversation, `/mcp add`, or hand-editing:

```bash
/mcp add <name> [--scope project|user] [--url <url>] [-- <command...>]
/mcp list
/mcp remove <name> [--scope project|user]
/mcp test <name>            # verify the connection
/mcp reauth <name>          # re-run OAuth flow
/mcp disable <name>; /mcp enable <name>
/mcp smithery-search <keyword> [--scope project|user] [--limit n] [--semantic]
```

Through conversation:

```text
> add MCP filesystem for /home/user/projects
> add MCP github
```

The agent writes the server into `.mcp.json` via `src/mcp/config-writer.ts`.

## Real example

```text
> add MCP filesystem for /home/user/projects
> list my files (agent calls filesystem MCP server tools)
> /mcp list
  • filesystem (stdio, project)
> /mcp test filesystem
```

## Failure behavior

- A server that fails to start or authenticate is reported by `/mcp test`; the
  agent degrades gracefully (that server's tools disappear from tool cache).
- Missing OAuth credentials route to the OAuth flow (`/mcp reauth`), or return
  an auth error for HTTP servers.

## Limitations

- Server tools are only available when the server is enabled and reachable at
  session start; dynamic reconnect is not guaranteed.
- Not all servers ship with a manual OAuth flow; Smithery-backed servers use
  their own auth path.

## Testing status

**PARTIAL** — implemented (`src/mcp/`, 22 files) with the `/mcp` surface
verified interactively; OAuth files and JSON-RPC lack committed end-to-end
server tests. Evidence: `src/mcp/*` + `docs/screenshots/mcp.png`.