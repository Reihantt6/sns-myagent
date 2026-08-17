# Plan Mode

## Purpose

Make the agent produce and commit to a plan before it starts executing tools,
so multi-step work is reviewed up front instead of improvised turn-by-turn.

## How it works

- `/plan [prompt]` toggles plan mode; the registry entry also reports status in
  autocomplete: `Plan: on (plan-file)` / `Plan: off` / `Plan: disabled in
  settings` / `Plan: blocked by goal mode`.
- State lives in `src/plan-mode/state.ts`: `enabled`, `planFilePath`, an
  optional `workflow` (`parallel` | `iterative`), and `reentry`.
- `src/plan-mode/approved-plan.ts` + `plan-protection.ts` implement the
  approved-plan concept — once a plan is approved the agent is prompted to stay
  within it; `plan-handoff.ts` persists it to `planFilePath`.
- `/plan-review` re-opens the review for the latest plan (plan mode only).

## Configuration

```yaml
plan:
  enabled: true    # master toggle (schema key plan.enabled)
```

## Real example

```text
> /plan
  (agent produces a plan file; you approve or iterate)
> make cli refactor plan
> /plan-review
> (approve → agent executes within the plan)
```

## Expected behavior

- With plan mode on and a plan present, prompts/steering prefer planning the
  work before tool calls, and `/plan-review` can reopen the file for review.
- `workflow: parallel` vs `iterative` changes how the plan is executed
  (fuzzy-matched phases exist in the todo system for parallel flows).

## Failure behavior

- Goal mode takes precedence: plan mode reports "blocked by goal mode" when
  both are active.
- Plan protection is advisory; there is no hard block on out-of-plan tool
  calls.

## Limitations

- No committed end-to-end test exercising the full plan → approve → execute
  cycle with a real agent loop.
- The plan file is a markdown artifact; enforcement relies on the model
  following the approved plan.

## Testing status

**PARTIAL** — implemented (`src/plan-mode/`, `plan.enabled`, `/plan`,
`/plan-review` registry entries), unit surface not deep-audited; no committed
end-to-end plan-mode test. Evidence: `src/plan-mode/*` and the registry wiring
above.