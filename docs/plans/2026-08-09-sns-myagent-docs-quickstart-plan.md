# SNS-MyAgent Documentation Quick Start Improvement Plan

> For Hermes: use this plan only as implementation guidance. Do not implement changes while creating this plan.

**Goal:** Make README.md and related docs clearly explain how to install, configure, run, and deploy SNS-MyAgent from a fresh machine.

**Architecture:** Keep the existing CLI and deployment behavior unchanged. Rewrite documentation around one canonical user path, then separate development, production service, and troubleshooting paths. Prefer commands already supported by the repository.

**Tech Stack:** Markdown, Bun, Node.js, npm, SNS-MyAgent CLI, systemd.

---

## Current Findings

- Repository: `/root/projects/sns-myagent`
- CLI binary name: `snsagent`, not `sns-myagent`
- Source entrypoint: `src/cli/entry.ts`
- Build output: `bin/snsagent-linux-x64` and `bin/snsagent`
- `package.json` exposes the npm binary as `snsagent`
- README contains installation and quick start sections, but the run flow is fragmented
- `deploy/README.md` documents systemd deployment separately
- `CONTRIBUTING.md` references `bun run dev`, but `package.json` currently has no `dev` script. This must be corrected or explicitly documented as unavailable.

## Documentation Contract

The finished docs must answer these questions without requiring code inspection:

1. What exactly should a normal user install?
2. What exact command starts the agent?
3. What is the difference between `snsagent`, `sns-myagent`, and the repository name?
4. How does first-run provider/API-key setup work?
5. How does a developer run from source?
6. How does a server operator run it as a systemd service?
7. Where are config, logs, secrets, and runtime data stored?
8. What commands verify that the installation works?
9. What are the first troubleshooting commands when startup fails?

---

## Task 1: Verify the Actual CLI Commands

**Objective:** Confirm every command documented in the quick start exists in the current source or package scripts.

**Files:**
- Inspect: `package.json`
- Inspect: `bin/snsagent.js`
- Inspect: `src/cli/entry.ts`
- Inspect: `README.md`
- Inspect: `CONTRIBUTING.md`

**Steps:**

1. List executable command handling and supported flags in `src/cli/entry.ts`.
2. Check whether `snsagent init`, `snsagent --version`, and `snsagent` are supported.
3. Check whether `bun run dev` exists. If it does not, do not invent it in the docs.
4. Run the verified commands from the repository root:

```bash
cd /root/projects/sns-myagent
bun run src/cli/entry.ts --version
bun run src/cli/entry.ts --help
```

5. Record the actual output and use only verified commands in the rewritten docs.

**Acceptance:** Every command in the final quick start maps to a real executable, script, or explicitly marked optional command.

---

## Task 2: Rewrite README Installation and Run Flow

**Objective:** Replace the fragmented installation guidance with a single obvious path for normal users and clearly labeled alternatives.

**Files:**
- Modify: `README.md`, sections `Installation` and `Quick Start`

**Required structure:**

1. Add a short "Which command do I run?" block near the top:

```text
Installed globally: snsagent
From source: bun run src/cli/entry.ts
Built binary: ./bin/snsagent
Repository directory: sns-myagent
```

2. Make the normal user path the first path:

```bash
npm install -g @sns-myagent/cli
snsagent
```

3. Make the source development path separate:

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts
```

4. Explain first launch in three short steps:
   - choose provider or custom Base URL
   - enter API key when required
   - choose a model and start chatting

5. Explain environment-variable setup only as an alternative, with no real secrets in examples.

6. State clearly that `sns-myagent` is the repository/project name and `snsagent` is the executable command.

7. Add a minimal verification block:

```bash
snsagent --version
snsagent --help
```

**Acceptance:** A new user can get from a clean shell to an interactive session by following only the first path.

---

## Task 3: Fix Development Documentation Drift

**Objective:** Remove or correct commands that are not present in `package.json`.

**Files:**
- Modify: `CONTRIBUTING.md`
- Modify: `README.md` development section if needed

**Steps:**

1. Remove `bun run dev` unless a verified `dev` script is added separately.
2. Use the actual source command for development:

```bash
bun run src/cli/entry.ts
```

3. Keep only scripts currently present in `package.json`, such as:

```bash
bun run build
bun test
bun run lint
bun run check
```

4. If watch mode is desired, document it as a future task instead of presenting it as available.

**Acceptance:** `CONTRIBUTING.md` contains no command that fails because the corresponding package script is absent.

---

## Task 4: Consolidate Production Deployment Instructions

**Objective:** Make production operation understandable without forcing users to search `deploy/README.md`.

**Files:**
- Modify: `README.md`
- Modify: `deploy/README.md` only where wording conflicts with README

**Required content:**

1. Add a "Run as a systemd service" section linking to `deploy/README.md`.
2. Show the actual order:

```bash
cd /root/projects/sns-myagent
bun install
bun run build
sudo bash deploy/install.sh
sudo systemctl status snsagent
```

3. Explain that `deploy/install.sh` stages files and does not enable services unless `--enable` is passed.
4. Document the secrets file path without exposing values:

```text
/etc/snsagent/secrets.env
```

5. Show safe operational commands:

```bash
sudo systemctl start snsagent
sudo systemctl restart snsagent
sudo systemctl status snsagent
journalctl -u snsagent -f
```

6. Explicitly distinguish interactive CLI usage from the Telegram/systemd daemon mode if the source behavior supports that distinction.

**Acceptance:** An operator can build, install, start, and inspect the service using the README alone plus the linked deployment details.

---

## Task 5: Add Minimal Troubleshooting and Verification

**Objective:** Give users fast, non-speculative diagnostics for the common startup failures.

**Files:**
- Modify: `README.md`
- Modify: `deploy/README.md` if service-specific diagnostics belong there

**Add cases:**

- `command not found: snsagent`: explain global npm install, PATH, and source fallback
- `bun: command not found`: point to Bun installation or npm binary path
- provider/model error: rerun setup and verify Base URL, API key, and model
- binary permission error: use `chmod +x bin/snsagent` only for source-built binary
- systemd service failed: run `systemctl status` and `journalctl`
- Telegram not responding: verify `/etc/snsagent/secrets.env` and service logs

**Acceptance:** Each case has one diagnostic command and one practical next action. Do not add long generic troubleshooting lists.

---

## Task 6: Verify the Documentation End to End

**Objective:** Prove the documented paths match the repository behavior.

**Files:**
- Test: documentation commands from a clean shell or isolated environment

**Steps:**

1. Check Markdown links and referenced files:

```bash
cd /root/projects/sns-myagent
python3 - <<'PY'
from pathlib import Path
for p in [Path('README.md'), Path('CONTRIBUTING.md'), Path('deploy/README.md')]:
    assert p.exists(), p
print('documentation files exist')
PY
```

2. Run the local CLI verification:

```bash
bun run src/cli/entry.ts --version
bun run src/cli/entry.ts --help
```

3. If dependencies are already installed, verify the build command:

```bash
bun run build
```

4. Confirm the binary exists after a successful build:

```bash
test -x bin/snsagent-linux-x64 || test -f bin/snsagent-linux-x64
```

5. Review the final README manually for one canonical path, consistent command names, and no claims unsupported by the source.

**Acceptance:** Documentation commands either execute successfully or are clearly labeled with prerequisites and expected limitations.

---

## Out of Scope

- No CLI behavior changes
- No new dependencies
- No new `dev` watcher unless explicitly requested later
- No provider or Telegram configuration changes
- No service enablement or secret modification
- No implementation of this plan during the planning task

## Final Deliverable

- Updated `README.md`
- Updated `CONTRIBUTING.md` if drift is confirmed
- Consistent `deploy/README.md`
- Verified command examples
- No fabricated output or unsupported setup claims

## Suggested Commit

```bash
git add README.md CONTRIBUTING.md deploy/README.md docs/plans/2026-08-09-sns-myagent-docs-quickstart-plan.md
git commit -m "docs: clarify sns-myagent setup and run flow"
```

Do not run the commit automatically unless explicitly requested.
