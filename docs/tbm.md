# Token Budget Manager (TBM)

## Status

TBM exists as an implementation under `src/tbm/` with unit tests in `src/tbm/__tests__/tbm.test.ts`. The `TbmManager` coordinates these subsystems:

- context delta processing
- context pyramid levels
- lazy skill loading
- tool output compression
- communication modes
- conversation tombstoning
- response caching
- token dashboard rendering

The broader claim that every TBM subsystem is integrated into every main agent turn is not a release guarantee. The projected savings below are design targets, not measured results.

## Current manager surface

`TbmManager` exposes methods for processing a turn, compressing tool output, caching responses, tombstoning messages, registering skills, switching communication mode, rendering the dashboard, and resetting the manager.

The source defaults enable the manager and its subsystems when a caller creates `new TbmManager()`.

## Token budgets that are separately integrated

The main source tree also has token budget controls for goals and subagent execution:

- Goal token budgets are implemented in `src/goals/runtime.ts`.
- Soft subagent request budgets are implemented in `src/task/executor.ts`.

These are separate from the `TbmManager` class.

## Planned or not guaranteed

The following remain design targets or require further integration and measurement before they should be advertised as automatic behavior of every session:

- provider-level prompt delta caching
- automatic multi-resolution context selection in the primary loop
- automatic lazy skill loading in every session
- universal tool-output compression in the primary loop
- automatic response caching for all requests
- a measured combined token reduction percentage

Do not describe TBM as saving a fixed percentage of tokens without benchmark data.

## Testing

Run the focused tests with:

```bash
bun test src/tbm/__tests__/tbm.test.ts
```

For the full project test suite, use:

```bash
bun test
```

## Configuration note

`src/tbm/config.ts` defines a TBM configuration object. Do not assume that a `tbm:` block in the persisted interactive settings file is consumed by the main agent unless the integration path is explicitly enabled by the running version.