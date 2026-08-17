# Subagents & Task Delegation

## Purpose

Delegate work to specialized child agents so the main agent can parallelize
independent subtasks instead of doing everything in one context.

## How it works

- The `task` tool (`src/task/index.ts`) spawns subagents. It discovers agent
  definitions from three places:
  - bundled agents shipped with the coding agent,
  - `~/.omp/agent/agents/*.md` (user-level),
  - `.omp/agents/*.md` (project-level).
- Each spawn gets a subagent prompt (`src/prompts/system/subagent-user-prompt.md`)
  with a fresh context; results come back as structured JSON events or session
  artifacts.
- Supports: single spawn (parallelism = multiple `task` calls), batch spawning
  with shared context when `task.batch` is enabled, background execution through
  `AsyncJobManager` when `async.enabled` is enabled, and progress events.
- The `/task` slash command manages the **async background** side
  (`/task run <description>`, `/task list`, `/task status <id>`).
- `src/task/parallel.ts` provides the parallel-fan-out helper used by
  multi-agent features; `src/agents/` adds consensus/critic/best-of-N patterns.

## Configuration

```yaml
task:
  batch: false      # allow batch spawn + shared context per call
async:
  enabled: true      # background execution through AsyncJobManager
```

## Real example

```text
> run three file-hunting jobs in parallel — one per directory
> (agent issues 3 task tool calls; each subagent returns its match list)
> /task run "port the parser to TypeScript"      # fire-and-forget background
> /task list
> /task status <id>
```

## Expected behavior

- Subagent results are delivered per-item; the caller sees usage + progress.
- Depth is bounded: `canSpawnAtDepth` prevents unbounded recursive spawning.
- With async enabled, `/task` shows live background jobs and their status.

## Failure behavior

- A killed parent process loses in-memory background task state unless the
  task runner persisted it (a `persisted-revive.ts` module exists for revival).
- Spawn limits (`canSpawnAtDepth`) reject deeper nesting with an error.

## Limitations

- Subagent isolation is logical (fresh context), not OS-level unless the PAL
  isolation backend is configured (`subagent.isolation: auto` → CoW/overlayfs).
- Not deep-audited end-to-end; register evidence is partial (some subagent
  executors carry unit tests, collaboration features mirror task events).

## Testing status

**PARTIAL** — implemented (`src/task/`, `src/agents/`) with unit tests on parts
(executor helpers, discovery, revive logic); no committed full pipeline test
that spawns a real subagent turn and asserts the round-trip. Evidence:
`src/task/*`, `src/agents/*`, async task-runner tests
(`src/async/__tests__/task-runner.test.ts`).