# Terminal UI Design — snscoder

> Custom branded terminal experience for SNS-MyAgent

## Philosophy

snscoder terminal MUST feel premium, not generic. User opens terminal → immediately knows this is snscoder, not another npm CLI tool.

## Visual Identity

### Color Palette (TBD — ask Bung for brand colors)

| Role | Color | Usage |
|------|-------|-------|
| **Primary** | TBD | Logo, headers, brand elements |
| **Accent** | TBD | Highlights, links, important info |
| **User input** | `#4FC3F7` (light blue) | User prompt indicator |
| **Agent response** | `#E0E0E0` (light gray) | Agent text output |
| **System** | `#78909C` (muted gray) | System messages, memory notes |
| **Success** | `#66BB6A` (green) | Task complete, tests pass |
| **Warning** | `#FFA726` (orange) | Warnings, rate limits |
| **Error** | `#EF5350` (red) | Errors, failures |
| **Muted** | `#616161` (dark gray) | Tool output (collapsed), metadata |

### Typography

```
snscoder v0.1.0                    ← Header (bold, primary color)
┌─ Provider: OpenRouter             ← Boxed status (boxen)
│  Model: claude-sonnet-4
│  Memory: SQLite (42 entries)
└─ Ready.

snscoder >                         ← User prompt (accent color)
```

## UI Components

### 1. Startup Banner

```
  ___            _      ___                _
 / __| ___  __ _| |__  / __|___  ___  __ _| |___
 \__ \/ _ \/ _` | '_ \| |  / __|/ _ \/ _` | / __|
 |___/\___/\__,_|_.__/|_|  \___|\___/\__,_|_\___|

 v0.1.0 | OpenRouter | claude-sonnet-4 | Memory: 42 entries
 Type /help for commands, /quit to exit
```

- ASCII art logo (compact, 4-5 lines max)
- Version + provider + model + memory count below
- Quick help hint
- **NOT full-screen** — stays compact

### 2. Chat Interface

```
snscoder > refactor auth module to use JWT
           ↑ accent color, branded prompt

✦ Agent                              ← agent name tag (primary color)
  Working on: auth/jwt.ts            ← task context
  ████████████░░░░ 67%              ← custom progress bar

  Updated 3 files:
    ✓ src/auth/jwt.ts               ← green checkmarks
    ✓ src/middleware/auth.ts
    ✓ src/types/auth.d.ts

  [memory] stored: user prefers JWT over session cookies  ← subtle memory note

snscoder > _
```

### 3. Tool Output (Collapsible)

```
⟳ Running: npm test                  ← spinner + tool name

  ┌─ terminal output ────────────── ← collapsed by default
  │ PASS  src/auth.test.ts
  │ PASS  src/middleware.test.ts
  │ Test Suites: 2 passed
  └─────────────────────────────────
  ✓ Tests passed (14 tests, 2.3s)   ← green summary

⟳ Running: git commit               ← next tool

  ✓ Committed: abc1234              ← compact result
```

### 4. Multi-Agent View

```
✦ Orchestrator                       ← main agent
  Task: "Build REST API + tests + deploy"

  ├─ 🟢 Agent A: Coder              ← green = running
  │  Model: claude-sonnet-4
  │  Progress: ████████░░ 80%
  │
  ├─ ✅ Agent B: Tester             ← done
  │  Model: gemini-2.5-pro
  │  Result: 14 tests passed
  │
  └─ ⏳ Agent C: DevOps            ← waiting
     Model: gpt-4o
     Status: Queued

  Elapsed: 2m 34s | Total tokens: 12,450
```

### 5. Status Bar (Bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ claude-sonnet-4 │ 2,340 tok │ Session: 12m │ Memory: 5 hit │
└─────────────────────────────────────────────────────────────┘
```

- Fixed at bottom of terminal
- Model name | tokens used this turn | session duration | memory hits
- Updates live

### 6. Error Display

```
✗ Error: ENOENT: no such file 'src/auth.ts'

  → File was renamed to src/auth/index.ts in commit abc1234
  → Suggestion: update import in src/middleware/auth.ts:3

  [memory] stored: src/auth.ts moved to src/auth/index.ts
```

- Red accent, not scary
- Actionable suggestion
- Auto-memory note if relevant

### 7. Memory Notifications

```
[memory] stored: "user prefers TypeScript strict mode"    ← subtle gray
[memory] recalled: "project uses vitest for testing"      ← subtle gray
[ memory] 3 entries auto-consolidated                     ← dim
```

- Non-intrusive, muted color
- Shows what was stored/recalled
- Can be silenced with config

### 8. Command Output

```
snscoder > /status

┌─ snscoder status ────────────────────┐
│ Version    │ 0.1.0                   │
│ Provider   │ OpenRouter              │
│ Model      │ claude-sonnet-4         │
│ Memory     │ SQLite (42 entries)     │
│ Session    │ 12m 34s                 │
│ Tokens     │ 12,450 used             │
│ Skills     │ 8 loaded                │
│ Agents     │ Idle                    │
└──────────────────────────────────────┘
```

## Tech Stack

| Package | Purpose | Size |
|---------|---------|------|
| **picocolors** | Terminal colors | ~2KB (lighter than chalk) |
| **ora** | Spinners | ~10KB |
| **boxen** | Boxed sections | ~5KB |
| **gradient-string** | Gradient text (logo) | ~8KB |
| **cli-table3** | Styled tables | ~15KB |
| **marked-terminal** | Markdown in terminal | ~10KB |
| **string-width** | Unicode-aware width | ~2KB |
| **Total** | | ~52KB |

> Lightweight. Adds ~52KB to install size (~20MB total target).

## Layout Modes

### Full Terminal (default)
```
┌──────────────────────────────────┐
│ Header (logo + status)           │
│──────────────────────────────────│
│                                  │
│ Chat area (scrollable)           │
│                                  │
│──────────────────────────────────│
│ Status bar (fixed bottom)        │
└──────────────────────────────────┘
```

### Compact (piped output / CI)
- No colors (auto-detect `!process.stdout.isTTY`)
- No spinners
- Plain text tables
- No ANSI escape codes

### Telegram (chat mode)
- No terminal UI
- Markdown formatting
- File attachments for code blocks
- Progress as text updates

## Inspiration

| Tool | What to borrow |
|------|---------------|
| **Vercel CLI** | Progress bars, deployment status |
| **Linear CLI** | Clean tables, color usage |
| **Claude Code** | Chat UX, tool output folding |
| **Warp** | Block-based output, command grouping |
| **Fig/Amazon Q** | Inline suggestions, autocomplete feel |

## Anti-patterns (AVOID)

- ❌ Rainbow text everywhere
- ❌ Giant ASCII art (4-5 lines max)
- ❌ Generic `Loading...` with no context
- ❌ Raw JSON for human output
- ❌ Full stack traces in user-facing errors
- ❌ Blinking text or annoying animations
- ❌ More than 3 colors active at once
- ❌ Progress bars without label/context
