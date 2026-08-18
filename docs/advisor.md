# Advisor (Second-Model Review)

## Purpose

A second model passively reviews each turn and injects brief notes - a cheap sanity check on the active model's output without changing the main loop.

## How it works

- `src/advisor/runtime.ts` orchestrates the reviews; `transcript-recorder.ts` captures the turn transcript; `watchdog.ts` bounds runaway review work.
- The advisor model is taken from the `advisor` model role; when enabled, each turn's transcript goes to the advisor and its note is injected as a hidden follow-up/steering message (see `src/session/agent-session.ts` onTurnEnd).
- `/advisor [on|off|status|dump [raw]]` controls and inspects it.

## Configuration

```yaml
advisor:
  enabled: true        # master toggle
  subagents: false     # also review spawned task/eval subagents
  syncBacklog: ...     # synchronize any backlogged reviews
```

## Real example

```text
> /advisor on
  (every turn: a second model reviews, note injected)
> /advisor status
> /advisor dump
> /advisor off
```

## Failure behavior

- Advisor failures do not break the main turn - review happens after the turn ends; errors are logged and the turn stands.
- `/advisor status` reflects the actual runtime state; a misconfigured advisor model role shows as such.

## Limitations

- Adds latency and extra model calls per turn (cost multiplier).
- Reviews are injective notes; they can't veto the main model's output.

