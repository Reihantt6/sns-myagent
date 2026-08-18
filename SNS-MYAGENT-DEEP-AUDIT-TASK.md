# SNS MyAgent — Deep Audit & Verification Task

## Target
Repository: https://github.com/Reihantt6/sns-myagent

This document is an execution spec for the coding agent. Do **not** treat README/docs as proof that a feature works. Inspect source, trace runtime integration, run tests, add missing tests, benchmark where relevant, and update documentation to match reality.

## Rules
Classify every audited feature as:
- `VERIFIED`
- `PARTIALLY_VERIFIED`
- `IMPLEMENTED_UNTESTED`
- `STUB`
- `EXPERIMENTAL`
- `PLANNED`
- `BROKEN`
- `DOC_ONLY`
- `UPSTREAM_INHERITED`

Never convert a feature to `VERIFIED` merely because a unit test is green. A real integration path must be demonstrated.

---

# 1. Baseline First

Run and record:

```bash
git status
git log -10 --oneline
bun install
bun test
```

Inspect:

```bash
find src -path '*__tests__*' -type f
find test -type f
find src/tbm -type f
find src/adapters/telegram -type f
find src/memory-backend -type f
```

Also trace configuration consumers:

```bash
grep -Rni "tbm:" src docs
grep -Rni "memory:" src docs
grep -Rni "TbmManager\|TBM\|token budget" src test docs
grep -Rni "autoRecall\|autoRetain\|retain\|recall" src test docs
```

Create a baseline report before making changes.

---

# 2. MEMORY — PROVE THAT IT REALLY WORKS

The repository exposes multiple memory backends and documents settings such as auto-recall, auto-retain, recall limits, and an injection-token limit. The existence of these files/settings is not enough. Verify the whole path:

```text
user input
→ retain
→ persistent storage
→ new process/session
→ recall
→ context injection
→ model
```

## Required tests

### 2.1 Explicit retain
Store a unique fact. Verify it is actually persisted.

### 2.2 Restart persistence
Process A retains fact X. Stop it. Process B recalls X. This must succeed without relying on in-memory state.

### 2.3 Semantic recall
Store several different facts. Query with paraphrased wording. Measure relevance and false positives.

### 2.4 Auto-retain
Enable auto-retain, run multiple turns, and verify new memory entries are actually generated according to configuration.

### 2.5 Auto-recall
Enable auto-recall, start a new session, and prove that a previously stored relevant fact is actually injected into the model context—not merely returned by a helper.

### 2.6 Injection budget
Test `injectionTokenLimit`, `recallLimit`, `recallContextTurns`, and query-length limits. Inspect the actual model payload where possible.

Expected invariant:

```text
actual injected memory <= configured limit
```

If token count is heuristic, document that.

### 2.7 Clear/delete
Run the supported memory-clear/delete mechanism and verify the entry is no longer recallable.

### 2.8 Backend OFF
With `memory.backend = off`, verify no unintended writes or silent persistence occur.

### 2.9 Backend switching
Test switching between enabled backends and `off`. Record whether data is shared, isolated, or intentionally not migrated.

### 2.10 Scope isolation
If scoping/banks/workspaces exist, prove memory from project A cannot leak into project B.

## Memory acceptance
A memory backend is not "working" until:
- persistence is demonstrated,
- retrieval is demonstrated,
- main-agent integration is demonstrated,
- relevant configuration limits are tested,
- and regression tests exist.

---

# 3. TBM — TOKEN BUDGET MANAGER MUST BE VERIFIED END-TO-END

Current repository evidence shows `src/tbm/` and a focused test file, but the existing TBM documentation explicitly distinguishes the manager's implementation from guaranteed integration into every main agent turn. Treat that as an audit target, not as proof of completion.

Inspect:

```text
src/tbm/
  comm-modes.ts
  config.ts
  context-delta.ts
  context-pyramid.ts
  dashboard.ts
  index.ts
  lazy-skills.ts
  response-cache.ts
  tombstone.ts
  tool-compress.ts
  __tests__/tbm.test.ts
```

## 3.1 Call-graph audit
For every TBM subsystem answer:
1. Who imports it?
2. Who calls it?
3. At what lifecycle stage?
4. Is it invoked on a real primary agent turn?
5. Is it feature-gated?
6. Is configuration actually consumed?
7. Does its result affect the model request or tool context?
8. Is it only tested in isolation?

Build an actual runtime diagram:

```text
User Turn
  ↓
Agent Loop
  ↓
TbmManager?
  ├─ context delta
  ├─ context pyramid
  ├─ lazy skills
  ├─ tool compression
  ├─ response cache
  ├─ tombstone
  └─ communication mode
```

Do not fill the diagram from design intent. Fill it from actual call paths.

## 3.2 Focused tests
Run:

```bash
bun test src/tbm/__tests__/tbm.test.ts
```

Then add/expand tests for:

### Context delta
Compare full context vs delta context. Measure token reduction and information loss.

### Context pyramid
Verify different resolution levels actually change payloads and preserve essential information.

### Lazy skills
Prove an unused skill stays unloaded and a required skill is loaded only when needed.

### Tool-output compression
Test:
- git diff
- test logs
- large JSON
- errors
- short output

Check semantic preservation, not only shorter text.

### Response cache
Test:
- first request = miss
- same valid request = hit
- changed context/tool state = miss
- invalidation
- stale-cache avoidance

### Tombstoning
Verify tombstoned messages do not re-enter active context unexpectedly.

### Dashboard
Verify displayed token numbers correspond to real counters.

## 3.3 TBM real-agent benchmark

Run at least:

### Scenario A — 20-turn conversation
Compare:

```text
TBM OFF
TBM ON
```

Measure:
- input tokens
- output tokens
- total tokens
- model calls
- latency
- tool calls

### Scenario B — large codebase
Perform search/read/edit/test/review. Compare OFF vs ON.

### Scenario C — long autonomous task
Measure:
- context size
- compactions
- total tokens
- latency
- completion success
- failures/retries

Do not claim a fixed savings percentage unless benchmark data proves it.

## TBM acceptance
TBM is considered operational only when:
- unit tests pass,
- at least one main-agent integration test proves invocation,
- benchmark data exists,
- no semantic regression is found,
- docs clearly distinguish measured behavior from design targets.

---

# 4. TELEGRAM — AUDIT THE REAL END-TO-END PATH

Inspect:

```text
src/adapters/telegram/
  bot.ts
  bridge.ts
  format.ts
  handler.ts
  index.ts
```

Test:

```text
Telegram message
→ handler
→ session
→ agent
→ model
→ tool
→ response
→ Telegram
```

Required:

- `/start`
- `/help`
- ordinary text
- long output
- errors
- restart/reconnect
- file upload
- file download
- harmless read operation
- harmless write operation
- harmless shell operation in an isolated test workspace

Also test:
- authorized user
- unauthorized user
- unknown chat
- group chat

If identity/access control is missing, mark it as a security gap and do not hide it in docs.

---

# 5. DOCUMENTATION GAP AUDIT

The repository already has:

```text
docs/
  configuration.md
  faq.md
  installation.md
  memory.md
  tbm.md
  terminal-ui.md
  termux.md
  troubleshooting.md
  screenshots/
```

Do a feature-to-doc audit rather than assuming coverage.

Create a matrix:

| Feature | Implemented | Tested | Documented | Screenshot | Status |
|---|---:|---:|---:|---:|---|
| Setup wizard | ? | ? | ? | ? | ? |
| Memory | ? | ? | ? | ? | ? |
| TBM | ? | ? | ? | ? | ? |
| Telegram | ? | ? | ? | ? | ? |
| Goal mode | ? | ? | ? | ? | ? |
| Subagent | ? | ? | ? | ? | ? |
| MCP | ? | ? | ? | ? | ? |
| Cron | ? | ? | ? | ? | ? |
| Browser | ? | ? | ? | ? | ? |
| Plugins | ? | ? | ? | ? | ? |
| Collaboration | ? | ? | ? | ? | ? |

Only fill cells with evidence.

## Docs likely worth evaluating
Do not create these just for volume. Add them when the subject is genuinely under-documented:

```text
docs/architecture.md
docs/agent-loop.md
docs/tools.md
docs/slash-commands.md
docs/providers.md
docs/models.md
docs/telegram.md
docs/mcp.md
docs/goals.md
docs/tasks.md
docs/cron.md
docs/subagents.md
docs/collaboration.md
docs/plugins.md
docs/skills.md
docs/security-model.md
docs/deployment.md
docs/testing.md
docs/development.md
docs/benchmarks.md
```

Every complex feature page should explain:

```text
Purpose
How it works
Configuration
Real example
Expected behavior
Failure behavior
Limitations
Testing status
```

---

# 6. SCREENSHOTS / PHOTOS — ACTUAL UI ONLY

Populate `docs/screenshots/` with screenshots from the **current application**, not stock imagery, AI-generated mockups, or generic terminal images.

At minimum evaluate screenshots for:

1. first-launch/setup wizard
2. main TUI
3. `/settings`
4. `/model`
5. `/memory stats`
6. `/memory diagnose`
7. TBM dashboard, if actually exposed
8. `/goal`
9. subagent/task flow
10. `/mcp`
11. Telegram conversation
12. Telegram command
13. cron
14. browser tool
15. tool approval
16. compaction/context view
17. `/stats`
18. representative error/troubleshooting state

Sanitize:
- API keys
- Telegram bot tokens
- passwords
- SSH credentials
- personal absolute paths
- private repository data

Each screenshot must:
- correspond to the current implementation,
- use a consistent filename,
- have a caption,
- be linked from the relevant docs page.

Example:

```md
![Memory statistics](./screenshots/memory-stats.png)

*Memory backend and retrieval statistics from the current running build.*
```

---

# 7. SECURITY GAP ANALYSIS

Audit actual attack surfaces:

```text
bash
eval
write/edit
ssh
browser
MCP
plugins
Telegram
cron
goals
subagents
GitHub
secrets
memory
```

For each:

```text
Attack surface
Existing control
Missing control
Exploitability
Impact
Recommended mitigation
Regression test
```

Focus on:
- prompt injection
- arbitrary command execution
- workspace/path escape
- malicious repository instructions
- malicious MCP/package supply chain
- secret exfiltration
- unauthorized Telegram control
- cross-session memory leakage
- privilege propagation to subagents
- cron persistence
- stale cache poisoning
- unsafe response caching

Use isolated fixtures/workspaces. Do not test destructive behavior against a real machine or real secrets.

---

# 8. UPSTREAM / LINEAGE COMPARISON

Compare SNS with the relevant upstream lineage, especially:

https://github.com/can1357/oh-my-pi

Compare:

```text
agent loop
tool execution
approval/security policy
context handling
compaction
memory
subagents
provider support
MCP
browser
LSP
DAP
Telegram
TUI
session persistence
testing
documentation
release cadence
```

Also inspect recent upstream changes for fixes/improvements that SNS may lack.

Create:

| Upstream change | SNS status | Impact | Action |
|---|---|---|---|
| ... | missing/present/adapted | high/medium/low | backport/adapt/ignore |

Do not blindly merge upstream. Check compatibility with SNS customizations.

Also inspect dependency drift:

```text
@sns-myagent/*
@oh-my-pi/*
lockfile versions
upstream current versions
```

Record:
- behind
- matching
- ahead/customized

---

# 9. CODE / CONFIG / MAINTAINABILITY AUDIT

Find:

```text
dead code
unused exports
duplicate logic
temporary stubs
TODO/FIXME
silent catches
unhandled promises
configuration that is declared but never consumed
features documented but not reachable
tests that only test mocks
```

For each configuration key:

```text
declaration
→ parsing
→ storage
→ runtime consumer
→ observable behavior
```

If a setting exists but does not affect runtime, mark it as a bug/gap.

---

# 10. OBSERVABILITY

Verify that important lifecycle events can be debugged:

```text
model call
tool call
memory retain
memory recall
TBM action
cache hit/miss
compaction
Telegram request
cron execution
goal execution
subagent execution
```

If tracing is insufficient, add structured debug logs with:
- session ID
- turn ID
- tool-call ID
- memory event ID
- TBM event ID

Never log secrets.

---

# 11. TEST MATRIX

Build at least:

## Unit
- TBM subsystems
- memory backends
- config resolution
- Telegram handlers
- cache
- compression
- goal budgets
- subagent budgets

## Integration
- agent + memory
- agent + TBM
- agent + MCP
- agent + Telegram
- agent + cron
- agent + subagent

## E2E
- startup
- setup
- conversation
- memory persistence
- Telegram
- goal
- cron
- TBM

Avoid tests that only assert "function was called". Prefer observable behavior and persistent state.

---

# 12. FINAL REPORT

Create:

```text
AUDIT-REPORT.md
```

with exactly these sections:

## Executive Summary
What genuinely works, what is partial, and what is missing.

## Feature Verification Matrix
Evidence-based status for major features.

## Memory Audit
Actual persistence, recall, auto-recall, auto-retain, limits, scope, and failures.

## TBM Audit
Subsystem-by-subsystem result, integration result, benchmark results, and measured token savings.

## Documentation Gap
Missing docs and documentation updated.

## Screenshot Inventory
All screenshots added and where they are used.

## Security Gap Analysis
Severity:
- CRITICAL
- HIGH
- MEDIUM
- LOW
- INFO

## Upstream Comparison
Important upstream differences and recommended backports/adaptations.

## Dependency Drift
Versions and compatibility findings.

## Changes Made
Files modified and rationale.

## Tests Executed
Exact commands and pass/fail result.

## Remaining Risks
Known limitations that remain.

---

# 13. EXIT CRITERIA

Do not call the task complete until:

- [ ] baseline is recorded
- [ ] memory persistence is proven
- [ ] memory recall is proven
- [ ] auto-retain is proven
- [ ] auto-recall is proven
- [ ] memory injection budget is verified
- [ ] memory clear/delete is verified
- [ ] TBM unit tests pass
- [ ] TBM main-loop integration is proven or clearly marked missing
- [ ] TBM benchmark data exists
- [ ] no unsupported TBM savings claim remains
- [ ] Telegram end-to-end path is tested
- [ ] Telegram authorization boundary is assessed
- [ ] docs are audited against source
- [ ] real screenshots are added
- [ ] screenshots are sanitized
- [ ] upstream comparison is complete
- [ ] dependency drift is documented
- [ ] security gaps are documented
- [ ] relevant regression tests are added
- [ ] full test suite passes
- [ ] build passes
- [ ] typecheck/lint passes where available
- [ ] README/docs reflect verified behavior

---

# 14. CORE PRINCIPLE

Do not optimize for "more features".

Optimize for:

```text
FEATURE
  ↓
IMPLEMENTED
  ↓
INTEGRATED
  ↓
TESTED
  ↓
MEASURED
  ↓
DOCUMENTED
  ↓
SCREENSHOTED
  ↓
SECURITY REVIEWED
```

Not:

```text
FEATURE
  ↓
FILE EXISTS
  ↓
README SAYS IT WORKS
```

If a feature is actually a stub, fix it or explicitly document it as incomplete.

If memory is implemented but not injected into the real agent context, fix the integration or document the limitation.

If TBM works only inside isolated unit tests, do not claim that it optimizes every session.

If benchmarks do not demonstrate savings, do not invent savings numbers.

Do not add major new features until these verification, integration, testing, documentation, and security gaps are addressed or explicitly recorded as known limitations.
