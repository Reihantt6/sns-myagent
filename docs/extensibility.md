# Plugins & Skills (Extensibility)

## Purpose

Extend the agent without touching core code: install plugins from marketplaces, add custom slash commands, custom tools, hooks, and drop markdown skills the agent can load on demand.

## How it works

- `src/extensibility/` is the umbrella:
  - `plugins/` - plugin lifecycle: `manager.ts`, `loader.ts`, `installer.ts`, `parser.ts`, `git-url.ts`, `doctor.ts`, `marketplace/` (sources + marketplace-auto-update), and legacy pi compat.
  - `custom-commands/`, `custom-tools/`, `extensions/`, `hooks/` - user additions registered with the session.
  - `skills.ts` - loads markdown skills from configured directories; skills live under `~/.omp/agent/` (user) and `.omp/` (project) trees and are scanned with `scanSkillsFromDir`.
  - `slash-commands.ts`, `tool-proxy.ts` - wiring for the above into the registry and tool loop.
- `/plugins` `[list|enable|disable]` manages installed plugins; `/marketplace` manages marketplace sources and installs.

## Configuration

```yaml
skills:
  enabled: true                # master toggle (schema default: true)
  enableSkillCommands: ...     # allow `/skill:<name>` invocation
  enableAgentsUser: true       # read .agents user-level skills
  enableAgentsProject: true    # read .agents project-level skills
  enablePiUser: true           # read .pi user-level skills
  enablePiProject: true        # read .pi project-level skills
marketplace:
  autoUpdate: ...              # plugin marketplace auto-update
```

Skill discovery mirrors the capability system used by MCP and agents: `scanSkillsFromDir` + `compareSkillOrder` in `src/discovery/helpers.ts`.

## Real example

```text
> /plugins list
> /marketplace search <term>
> load coding skill           # agent loads a skill by name on demand
```

## Failure behavior

- A broken plugin package surfaces errors from `doctor.ts`/`loader.ts` instead of corrupting the session.
- Marketplace auto-update failures leave the currently installed version in place.

## Limitations

- Plugin/skill ecosystem is opinionated about directory layout; skills in the wrong tree simply aren't discovered.
- Marketplace features are implemented but have no committed test.

