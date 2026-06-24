# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | ✅ Active support  |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Email: [security@reihantt6.dev](mailto:security@reihantt6.dev) (or DM via GitHub)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

Response timeline:
- Acknowledgment: 48 hours
- Initial assessment: 1 week
- Fix + disclosure: 2 weeks (or coordinated with reporter)

## Security Model

### Local-first design
- All data stored locally (`~/.sns-myagent/`)
- No telemetry, no analytics, no phone-home
- API keys never leave your machine (except to your configured LLM provider)

### API Key Handling
- Keys stored in environment variables or `config.yaml`
- `config.yaml` should be in `.gitignore` (never committed)
- Keys passed to providers over HTTPS only

### Terminal Tool
- Command approval gating enabled by default (`tools.terminal.require_approval: true`)
- Blocked commands: `rm -rf /`, `shutdown`
- Configurable allowlist/blocklist

### Memory System
- SQLite database at `~/.sns-myagent/memory.db`
- No external memory services unless explicitly configured (Mem0 cloud)
- Self-hosted Mem0 recommended for sensitive data

### MCP Servers
- Agent installs MCP servers from npm (public registry)
- Verify server packages before allowing install
- MCP servers run as child processes (same user permissions)

## Best Practices

1. **Never commit `config.yaml`** — it may contain API keys
2. **Use `.env` files** for API keys in development
3. **Use self-hosted Mem0** instead of cloud for sensitive memories
4. **Review MCP server packages** before installing
5. **Run as non-root user** in production
6. **Keep Bun updated** (>= 1.3.14)

## Dependencies

- Runtime dependencies audited via `bun audit`
- No known vulnerabilities in direct dependencies at time of release
- Run `bun audit` to check current state

## License

This project is MIT licensed. Security contributions welcome.
