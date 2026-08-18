# Goal Mode

## Purpose

An autonomous, persistent objective for a session. While a goal is active, the agent steers its own turns toward the objective (with a token budget and wall-clock accounting) instead of waiting for step-by-step instructions.

## How it works

- `/goal set <objective>` starts mode and records the goal; the runtime (`src/goals/runtime.ts`) tracks per-turn and wall-clock usage.
- Each turn, the goal runtime injects a steering prompt (`goal-mode-active.md`) so the model keeps the objective in mind; when the token budget is low it switches to `goal-budget-limit.md`; on continuation it uses `goal-continuation.md`.
- State is persisted by the host (`persist(mode)` → `goal` / `goal_paused` / `none`), so a paused goal survives restarts.
- Subcommands: `set`, `show`, `pause`, `resume`, `drop`, `budget` (see `src/slash-commands/builtin-registry.ts` `goal` entry).

## Configuration

```yaml
goal:
  enabled: true            # master toggle (schema default: true)
  statusInFooter: true     # show goal state in the TUI footer
  continuationModes: [...] # prompt modes used for continuation steering
```

Schema keys: `goal.enabled`, `goal.statusInFooter`, `goal.continuationModes` (`src/config/settings-schema.ts`).

## Real example

```text
> /goal set implement --dry-run flag for the backup command and verify it
> (agent keeps working across turns, steering itself toward the objective)
> /goal status / /goal show        # inspect current goal + budget
> /goal pause                      # suspend without losing the objective
> /goal resume
> /goal drop                       # end the objective
```

## Expected behavior

- With `goal.enabled: true`, a set goal changes the injected system/steering prompts so the model maintains focus across turns.
- Token budget accounting logs usage per turn and can trigger a budget-limit steering prompt when exhausted.
- `persist` writes mode + state so a paused goal can be resumed next launch.

## Failure behavior

- Plan mode and goal mode conflict: plan mode reports "blocked by goal mode" when goal mode is active.
- Goal mode is session-scoped; a dead process loses in-memory goal state unless it was persisted by the host.

## Limitations

- Budget steering is prompt-based, not a hard kill-switch; the model may still overshoot slightly before the budget-limit prompt takes effect.
- No multi-session goal ownership: the goal lives in the session that set it.

## Screenshot

![Goal mode active objective](../docs/screenshots/goal.png)

`/goal show` with an active objective; the footer carries the Goal indicator and token budget.

