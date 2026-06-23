# Contributing to SNS MyAgent

Thanks for your interest. This is a personal project, but contributions are welcome and selectively reviewed.

## Quick Start

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
npm install
npm run dev
```

## Development Setup

### Prerequisites
- Node.js >= 20.0
- npm >= 10.0
- Git >= 2.0
- TypeScript 5.x

### Commands
```bash
npm run dev          # Watch mode (hot reload)
npm run build        # Build TypeScript → dist/
npm test             # Run tests
npm run lint         # ESLint check
npm run typecheck    # TypeScript type check
```

## How to Contribute

### 1. Fork & Branch
```bash
git checkout -b feature/my-change
```

### 2. Make Changes
- Follow existing code style (TypeScript strict mode)
- Add tests for new tools/features
- Update docs if adding/changing behavior

### 3. Test
```bash
npm test
npm run lint
npm run typecheck
```

### 4. Commit
```bash
git commit -m "add: new feature description"
```

### 5. Push & PR
```bash
git push origin feature/my-change
```
Open a Pull Request on GitHub.

## Commit Convention

| Prefix | Usage |
|--------|-------|
| `add:` | New feature or file |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring, no behavior change |
| `docs:` | Documentation changes |
| `test:` | Test additions or changes |
| `chore:` | Maintenance tasks |
| `perf:` | Performance improvement |

## Code Style

- TypeScript with strict mode
- ESLint + Prettier
- No `any` types (use proper typing)
- Tests required for new tools

## Adding a New Tool

1. Create `src/tools/my-tool.ts`
2. Export `definition` (ToolDefinition) and `execute` function
3. Register in `src/tools/index.ts`
4. Add tests in `src/tools/__tests__/my-tool.test.ts`
5. Update README.md Tools section

## Adding a New Skill

1. Create `.md` file in `skills/`
2. Include YAML frontmatter (name, description, tags)
3. Test by loading: `/load my-skill`
4. Compatible with [agentskills.io](https://agentskills.io) format

## Questions?

Open a GitHub Discussion or Issue.

## License

By contributing, you agree your contributions will be licensed under MIT.
