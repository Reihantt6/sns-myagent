# Token Budget Manager (TBM) — Design Document

> **Status: Planned (Phase 3).** This document describes the design target for TBM. None of the features below are implemented yet.

## What Exists Today

Source code has two budget-related features:

1. **Goal token budgets** (`src/goals/runtime.ts`): Each goal can set a `token_budget` integer. When usage exceeds the budget, goal status transitions to `budget-limited` and a budget-limit prompt is injected.

2. **Subagent request budgets** (`src/task/executor.ts`): Soft per-subagent request limits. Crossing the budget injects a steering notice; at 1.5x the budget the run aborts gracefully, salvaging partial output.

These are the only token-budget features verified in source code.

---

## Planned Features (Not Implemented)

The following are design targets for Phase 3. They do not exist in the codebase.

### Context Delta Caching

Instead of resending full context every turn, send only what changed. Static prefix (system prompt, tools, identity) cached at provider level; dynamic suffix (recent messages, tool output) sent as delta. Target savings: 60-80% input tokens after turn 1.

### Multi-Resolution Context Pyramid

Load context in levels, escalating only when response quality drops:

| Level | Content | Tokens | When |
|-------|---------|--------|------|
| 0 | Identity only | ~100 | Simple Q&A |
| 1 | + Last 3 messages | ~500 | Continuation |
| 2 | + Relevant memories | ~1,000 | Contextual tasks |
| 3 | + Relevant skills | ~2,000 | Complex tasks |
| 4 | + Full history | ~5,000 | Deep research |

### Lazy Skill Loading

Inject skill names only (~200 tokens) into every prompt. Load full skill content on-demand when relevant. Target: ~700 tokens vs 50,000+ if all loaded.

### Tool Output Auto-Compress

| Tool | Max Budget | Strategy |
|------|-----------|----------|
| `terminal` | 500 tokens | Truncate + strip ANSI |
| `read_file` | 800 tokens | Only relevant lines |
| `web_extract` | 1,000 tokens | Summarize key content |
| `search_files` | 300 tokens | Top N results only |

### Communication Modes

| Mode | Example | Tokens | Use Case |
|------|---------|--------|----------|
| Caveman | `Bug auth. Fix: token_exp < not <=.` | ~20 | Debug, quick ops |
| Normal | `Found bug in auth middleware. Token expiry check uses wrong operator.` | ~60 | Daily work |
| Verbose | Full explanation with context and alternatives... | ~150 | Learning, docs |

Switch via `/mode caveman` or auto-detect by task complexity.

> **Note:** RTK (`pi-rtk-optimizer`) is a separate theme/UI plugin. It is unrelated to communication modes.

### Conversation Tombstoning

Compress old messages to minimal references. Model can still reference originals if needed. Target: 85% context reduction.

### Response Cache

Exact match (`hash(query)`) and semantic match (embedding similarity > 0.95). Cache hit rate displayed in token dashboard.

### Token Dashboard

`/tokens` command showing session duration, input/output/cached tokens, cost estimate, and cache hit rate.

---

## Savings Estimates (Projected)

| Technique | Savings | Complexity |
|-----------|---------|------------|
| Context Delta Caching | 60-80% | High |
| Multi-Resolution Pyramid | 40-60% | Medium |
| Tool Output Budget | 30-50% | Low |
| Lazy Skill Loading | 90%+ | Low |
| Conversation Tombstoning | 50-70% | Medium |
| Response Cache | 100% (hit) | Low |
| **Combined** | **60-80%** | — |

> These are projected savings, not measured. None of the above techniques are implemented.
