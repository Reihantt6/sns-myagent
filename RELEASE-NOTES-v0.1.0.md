# Release Notes — v0.1.0

First binary release of **sns-myagent** (CLI: `snscoder`).

## Highlights

- Prebuilt standalone binary (`bin/snscoder`, ~92 MB, Linux x64, ELF).
- Telegram adapter wired to CLI entry point.
- Integration test suite (`test/telegram.test.ts`).
- Cleanup pass: dead code removed, types aligned, defaults centralized.
- TypeScript: 0 errors.

## What Changed Since Last Release

This is the **first** tagged release, so everything since the public repo was created is new.

- **Binary build pipeline:** `bin/snscoder` produced via `pkg`-style bundling.
- **Telegram adapter:** `src/adapters/telegram/{bot,format,handler,index}.ts` — bot init, message routing, output formatting.
- **Config system:** `src/config/{schema,loader,defaults}.ts` — typed schema + file-based loader.
- **CLI refactor:** `src/cli/index.ts` + new `src/cli/entry.ts` — single entry, wired adapters.
- **Tests:** `test/telegram.test.ts` — adapter integration coverage.
- **Docs:** CHANGELOG updated, fabricated slash-commands/tools table removed, internal phase tracker moved out of public docs.

Commit: `c156e8c — v0.1.0: prebuilt binary, telegram adapter, integration tests, cleanup`

## Binary Download

Binary is committed in the repo at `bin/snscoder` (Linux x64, dynamically linked).

Via git:

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
./bin/snscoder --help
```

Direct download from tag:

```bash
curl -L -o snscoder https://raw.githubusercontent.com/Reihantt6/sns-myagent/v0.1.0/bin/snscoder
chmod +x snscoder
./snscoder --help
```

> Note: GitHub flagged the binary as >50 MB. It works fine but pulls heavy on `git clone`. Future releases may move to GitHub Releases with the binary as a downloadable asset to slim the clone.

## Installation

Requirements:

- Linux x64 (binary is ELF dynamically linked; glibc ≥ 2.17 expected).
- For source build: Node.js ≥ 18, npm/pnpm.

From binary:

```bash
chmod +x bin/snscoder
./bin/snscoder --help
```

From source:

```bash
npm install
npm run build
node bin/snscoder.js --help
```

Configuration file: place a `config.json` in `.sns-myagent/` (see `src/config/schema.ts` for shape).

## Known Issues

- **Large binary in repo:** `bin/snscoder` is ~92 MB, exceeds GitHub's 50 MB recommendation. `git clone` will pull it every time. Mitigation planned for v0.2.0 (move to Release assets + add `npm` ignore rule for `bin/` on source-only installs).
- **`pi_natives.linux-x64-modern.node` 404 during optional postinstall:** harmless — that native module is only required for older Node fallback paths. Verified not needed for v0.1.0 runtime. Cosmetic warning only.
- **Binary stripped of debug symbols only when built via fallback path:** default `pkg` build keeps symbols. Size is larger than strictly necessary. Trimming planned.
- **No Windows / macOS binary yet** — Linux x64 only. Cross-compile planned for v0.2.0.

## Roadmap (v0.2.0+)

- **Phase 3 — Multi-adapter:** Discord, Slack, WhatsApp adapters following the Telegram pattern.
- **Phase 3 — Streaming output:** token-by-token streaming for long generations (Telegram supports this natively).
- **Phase 3 — Persistent conversation store:** SQLite-backed session memory across restarts.
- **Phase 4 — Plugin system:** allow user-supplied adapters without forking.
- **v0.2.0 release engineering:**
  - Move binary to GitHub Release asset (slim repo).
  - Cross-compile for macOS (arm64 + x64) and Windows x64.
  - `npm publish` for source-only installs.
  - Reproducible builds (lockfile + build hash in release notes).

## Verification

- Commit SHA: `c156e8c`
- Tag: `v0.1.0`
- Tree clean post-commit.
- TS compile: 0 errors.