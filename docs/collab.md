# Collaborative Sessions (Collab)

## Purpose

Share a live agent session with other people - guests watch the transcript and session entries in real time, and (unless the link is read-only) can prompt and abort the session. The host machine runs the agent and all tools.

## How it works

- `/collab` (or `/collab start`) hosts: `src/collab/host.ts` taps the session event stream + append chokepoint and broadcasts entries/state to guests through a relay. `src/collab/guest.ts` is the guest side.
- Frames are AES-256-GCM sealed (`crypto.ts`); the relay only sees an encrypted envelope plus control messages - no session data (`src/collab/protocol.ts`).
- `/collab view` shares a read-only link (guests can watch, not prompt); `/join <link>` joins; `/leave` leaves.
- Subagent ecosystem is mirrored too: task EventBus traffic, agent-registry snapshots (Agent Hub table), hub chat/kill/revive commands.
- Default relay: `wss://my.omp.sh` (from `@oh-my-pi/pi-wire`).

## Configuration

```text
/collab [start|view|status|stop] [relayUrl]
/collab status         # link + participant count
/join <link>
/leave
```

## Real example

```text
> /collab
  → "hosting (0 guests)" + a share link
> share link with a teammate
> /collab status
  → hosting (2 guests)
> /collab stop
```

## Expected behavior

- Read-only links (`/collab view`) never allow guest prompts.
- Guests' messages go through the host's agent as steering; host sees participant additions in `/collab status`.

## Failure behavior

- Bad relay URL is normalized/rejected by `protocol.ts` (`normalizeRelayUrl`).
- If the relay is unreachable, hosting fails with a connection error; existing sessions are unaffected.

## Limitations

- Requires a reachable relay; the default relay is a hosted third-party service (`wss://my.omp.sh`), so act accordingly if you care about confidentiality for production work (frames are encrypted, but the relay is a shared endpoint).
- Session sharing is real-time streaming, not a fork; guests can't run their own tools.

