1|# PLAN-PHASE-5 — Multi-Agent SNS Branding + New Modules
2|
3|> Status: 🔥 IN PROGRESS | Created: 2026-06-25 | Updated: 2026-06-27
4|> Scope: Wrap existing Pi multi-agent infra + add ensemble + error resilience
5|
6|---
7|
8|## Existing Infrastructure (DON'T REBUILD)
9|
10|Pi Agent fork already has:
11|- `AgentRegistry` — global registry, status tracking, events
12|- `AgentLifecycleManager` — idle/parked/revived, TTL timers
13|- `Task Executor` (2356 lines) — full subagent execution
14|- `mapWithConcurrencyLimit` + `Semaphore` — parallel execution
15|- Bundled agents: explore, plan, designer, reviewer, librarian, oracle, task, quick_task
16|- `orchestrate.ts` — keyword-based orchestrate mode activation
17|- RPC subagents — event-based comms, transcript streaming
18|- Agent discovery — `.agent/` and `.agents/` directory scanning
19|
20|---
21|
22|## Task 5.1: SNS Orchestration CLI Wrapper
23|
24|### Subtasks
25|
26|- [ ] 5.1a: Create `src/agents/sns-orchestrator.ts` — thin wrapper over existing orchestrate mode
27|  - Imports existing `AgentRegistry`, `AgentLifecycleManager`, task executor
28|  - SNS-branded progress reporting using `src/tui/` components
29|  - CLI entry: `snscoder orchestrate "task description"`
30|- [ ] 5.1b: Create `src/commands/orchestrate.ts` — CLI command
31|  - Parse task, spawn orchestrator, stream progress
32|  - Uses `renderChatBlock()` for agent output, `renderToolBlock()` for tool calls
33|  - Status bar shows active agents + progress
34|- [ ] 5.1c: Wire into CLI entry (`src/cli/entry.ts`)
35|  - Register `orchestrate` as top-level command
36|
37|---
38|
39|## Task 5.2: agents.yaml Config System
40|
41|### Subtasks
42|
43|- [ ] 5.2a: Design `agents.yaml` schema (extends existing `.agent/` discovery)
44|  ```yaml
45|  # ~/.sns-myagent/agents.yaml (user-level)
46|  # OR ./.sns-myagent/agents.yaml (project-level)
47|  agents:
48|    coder:
49|      model: claude-sonnet
50|      tools: [bash, read, write, search]
51|      system_prompt: "You are a coding assistant..."
52|      thinking_level: high
53|    reviewer:
54|      model: gpt-4o
55|      tools: [read, search]
56|      system_prompt: "You are a code reviewer..."
57|    researcher:
58|      model: perplexity
59|      tools: [web_search, fetch]
60|      system_prompt: "You are a researcher..."
61|  
62|  ensembles:
63|    code_review:
64|      strategy: critic  # consensus | critic | best_of_n
65|      generator: coder
66|      critic: reviewer
67|      max_rounds: 2
68|    deep_research:
69|      strategy: consensus
70|      agents: [researcher, coder]
71|      threshold: 0.7
72|  ```
73|- [ ] 5.2b: Implement `src/agents/config.ts` — YAML parser + validator
74|  - Uses `arktype` (already in deps) for validation
75|  - Hot-reload via `fs.watch`
76|  - Falls back to bundled agents when no custom config
77|- [ ] 5.2c: Agent role resolver — task → agent matching
78|  - Keyword matching + explicit `@agent` mention
79|  - Default: use bundled `task` agent
80|
81|---
82|
83|## Task 5.3: Ensemble Module (NEW)
84|
85|### Subtasks
86|
87|- [ ] 5.3a: Create `src/agents/ensemble.ts` — ensemble orchestrator
88|  - **Consensus**: spawn N agents same prompt, pick majority/best answer
89|  - **Critic**: generator agent → critic agent reviews → iterate
90|  - **Best-of-N**: generate N responses, rank by scoring agent
91|- [ ] 5.3b: Implement `src/agents/strategies/consensus.ts`
92|- [ ] 5.3c: Implement `src/agents/strategies/critic.ts`
93|- [ ] 5.3d: Implement `src/agents/strategies/best-of-n.ts`
94|- [ ] 5.3e: Cost tracking per model per ensemble run
95|  - Aggregate token usage across all ensemble agents
96|  - Report cost breakdown after ensemble completes
97|
98|---
99|
100|## Task 5.4: Error Resilience (NEW)
101|
102|### Subtasks
103|
104|- [ ] 5.4a: Create `src/agents/resilience.ts` — retry + timeout + circuit breaker
105|  - Retry with exponential backoff (3 attempts default)
106|  - Per-task timeout (configurable, default 120s)
107|  - Circuit breaker: open after 3 consecutive failures per provider
108|  - Fallback models: if primary fails, try fallback chain
109|- [ ] 5.4b: Dead letter queue for failed tasks
110|  - Persist failed tasks for later retry
111|  - `/retry <task_id>` command
112|- [ ] 5.4c: Graceful degradation
113|  - If ensemble quorum not met, return best available
114|  - If subagent timeout, partial results preserved
115|
116|---
117|
118|## Task 5.5: Progress Dashboard (TUI)
119|
120|### Subtasks
121|
122|- [ ] 5.5a: Multi-agent progress view using existing `src/tui/` + agent hub
123|  - Tree view: main agent → sub-agents with status
124|  - Live updates via existing EventBus
125|  - Uses `renderChatBlock()` for each agent's output
126|- [ ] 5.5b: Agent summary after orchestration completes
127|  - Total time, tokens, cost, agents used
128|  - Per-agent breakdown
129|
130|---
131|
132|## Task 5.6: Commit + Tag
133|
134|- [ ] 5.6a: Commit all Phase 5 changes
135|- [ ] 5.6b: Update CHANGELOG.md (public)
136|- [ ] 5.6c: Tag v0.3.0
137|- [ ] 5.6d: Update PROGRESS.md + KANBAN.md (internal, .gitignore)
138|
139|---
140|
141|## Execution Order
142|
143|```
144|5.1 (CLI wrapper) → 5.2 (agents.yaml) → 5.3 (ensemble) → 5.4 (resilience) → 5.5 (TUI) → 5.6 (commit)
145|```
146|
147|## Success Criteria
148|
149|- [ ] `snscoder orchestrate "build login page"` spawns agents + shows branded progress
150|- [ ] `agents.yaml` configures custom agent roles
151|- [ ] Ensemble: critic reviews code before output
152|- [ ] Failed tasks retry automatically (3x backoff)
153|- [ ] Circuit breaker opens after 3 provider failures
154|- [ ] TUI shows multi-agent tree view during orchestration
155|- [ ] TS clean, binary works
156|

---

## Task 5.3: Async Workflow Engine

> Spawn background tasks from CLI/Telegram, continue chatting, get notified on completion.
> Different from multi-agent orchestrator (5.1) — this is UX non-blocking, not agent coordination.

### Infrastructure (already in Pi fork)
- `Semaphore` + `mapWithConcurrencyLimit` — parallel execution control
- `TaskExecutor` (2356 lines) — subagent execution
- `src/cron/` — reference pattern for SQLite-backed background worker

### Subtasks

- [x] 5.3a: Create `src/async/types.ts` — type definitions
- [x] 5.3b: Create `src/async/task-store.ts` — SQLite persistence (bun:sqlite, WAL)
- [x] 5.3c: Create `src/async/task-runner.ts` — background execution engine
- [x] 5.3d: Create `src/async/notifier.ts` — notification dispatch (CLI + Telegram)
- [x] 5.3e: Create `src/async/index.ts` — barrel export
- [x] 5.3f: Create `src/slash-commands/helpers/task.ts` — /task command handler
- [x] 5.3g: Register in `src/slash-commands/builtin-registry.ts` — subcommands: run, list, status, cancel, result
- [x] 5.3h: Wire into Telegram handler — /task command added to COMMANDS set
- [x] 5.3i: Tests — task-store + task-runner (bun:test)
- [x] 5.3j: TSC verify + commit

### Schema (task-store)
```sql
CREATE TABLE IF NOT EXISTS async_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  task_type TEXT NOT NULL DEFAULT 'prompt',
  description TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_async_tasks_status ON async_tasks(status);
```

### Slash Commands
- `/task run <description>` — spawn async task in background
- `/task list` — show running/pending tasks
- `/task status <id>` — check specific task
- `/task cancel <id>` — cancel running task
- `/task result <id>` — get full result
