# Token Budget Manager (TBM)

Built-in token efficiency system. No other agent has this.

---

## Problem

Every API call sends: system prompt (~2000 tokens) + conversation history (growing) + tool definitions (~1500 tokens) + skills + memories. Long sessions cost real money.

## Solution

TBM optimizes at every layer:

```
┌─────────────────────────────────────────────┐
│           TOKEN BUDGET MANAGER              │
├─────────────────────────────────────────────┤
│  Context Delta Cache │ Multi-Res Pyramid    │
│  Caveman Mode (RTK)  │ Lazy Skill Loading   │
│  Tool Output Budget  │ Response Cache        │
│  Semantic Dedup      │ Token Dashboard       │
└─────────────────────────────────────────────┘
```

---

## 3 Communication Modes

| Mode | Example | Tokens | Use Case |
|------|---------|--------|----------|
| **Caveman** (RTK) | "Bug auth. Fix: `token_exp <` not `<=`." | ~20 | Debug, quick ops |
| **Normal** | "Found bug in auth middleware. Token expiry check uses wrong operator." | ~60 | Daily work |
| **Verbose** | Full explanation with context and alternatives... | ~150 | Learning, docs |

Switch via `/mode caveman` or auto-detect by task complexity.

---

## Context Delta Encoding

Instead of resending full context every turn, TBM sends only what changed:

```
Turn 1: [full context 2000 tokens] → API call
Turn 2: [delta: +200 tokens]       → cached prefix + delta
Turn 3: [delta: +150 tokens]       → cached prefix + delta
```

- **Static prefix** (system prompt, tools, identity) cached at provider level
- **Dynamic suffix** (recent messages, tool output) sent as delta
- **Savings**: 60-80% input tokens after turn 1

---

## Multi-Resolution Context Pyramid

Not all context is equal. TBM loads context in levels:

| Level | Content | Tokens | When |
|-------|---------|--------|------|
| 0 | Identity only | ~100 | Simple Q&A |
| 1 | + Last 3 messages | ~500 | Continuation |
| 2 | + Relevant memories | ~1,000 | Contextual tasks |
| 3 | + Relevant skills | ~2,000 | Complex tasks |
| 4 | + Full history | ~5,000 | Deep research |

Start at Level 0. Escalate only if response quality drops.

---

## Tool Output Auto-Compress

| Tool | Max Budget | Strategy |
|------|-----------|----------|
| `terminal` | 500 tokens | Truncate + strip ANSI |
| `read_file` | 800 tokens | Only relevant lines |
| `web_extract` | 1,000 tokens | Summarize key content |
| `search_files` | 300 tokens | Top N results only |

---

## Lazy Skill Loading

Don't inject all 100+ skills into every prompt:

```
Skills Index (always): ~200 tokens (names only)
Relevant skill loaded: +500 tokens (on-demand)
Total: ~700 tokens vs 50,000+ if all loaded
```

---

## Conversation Tombstoning

Old messages compressed to minimal references:

```
Original:  "Can you help me fix the auth bug? The token expiry check..." (100 tokens)
Tombstone:  [MSG-42: Auth bug, token_exp fix]  (15 tokens)
```

Model can still reference MSG-42 if needed. Context 85% smaller.

---

## Response Cache

Repeated queries return cached responses with zero API calls:

- Exact match: `hash(query)` lookup, TTL-based
- Semantic match: embedding similarity > 0.95 threshold
- Cache hit rate displayed in token dashboard

---

## Token Dashboard

```
/tokens

Session: 2h 15m
─────────────────────────────
Input:    12,450 tokens
Output:    3,200 tokens
Cached:    1,800 tokens (saved!)
─────────────────────────────
Total:    15,650 tokens
Cost:     $0.038
Cache Hit: 72%
```

---

## Savings Summary

| Technique | Savings | Complexity |
|-----------|---------|------------|
| Context Delta Encoding | 60-80% | High |
| Multi-Resolution Pyramid | 40-60% | Medium |
| Tool Output Budget | 30-50% | Low |
| Semantic Deduplication | 20-30% | Medium |
| Lazy Skill Loading | 90%+ | Low |
| Conversation Tombstoning | 50-70% | Medium |
| Response Cache | 100% (hit) | Low |
| **Combined** | **70-90%** | — |
