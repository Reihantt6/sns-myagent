# Development - custom `node_modules` & install mechanism

This repo uses a **custom `postinstall`** that deviates from a plain `bun install`. This page documents exactly what it does, how to reproduce a from-scratch install, and the current dependency drift against upstream.

## Runtime

- **Runtime**: Bun `>= 1.3.14` (`engines.bun`).
- **Lockfiles**: `bun.lock` (Bun, tracked) and `package-lock.json` (npm, tracked). There is **no `bun.lockb`** - the Bun text lockfile is the one `bun install` reads.
- **Package name**: `@sns-myagent/cli` (v0.3.9). There are **no external `@sns-myagent/*` dependencies** - that scope appears only as the package's own identity, used by the version/update checkers (`src/cli/update-cli.ts`, `src/tui/splash.ts`, `src/main.ts`).

## The `postinstall` pipeline

`package.json` `scripts.postinstall`:

```sh
node scripts/fetch-binary.mjs && node scripts/apply-pi-natives-patch.js
```

### 1. `scripts/fetch-binary.mjs` - download the prebuilt binary

- Queries `GET https://api.github.com/repos/Reihantt6/sns-myagent/releases/latest`.
- Picks the asset for the current platform/arch (glibc → `snsagent-linux-{x64,arm64}`, musl fallback, `snsagent-macos-*`, `snsagent-windows-x64.exe`).
- Downloads it into `bin/` and writes a shim `bin/snsagent.js` that `spawn`s the platform binary (the shim is what `package.json` `"bin"` points at, so a global `npm install -g @sns-myagent/cli` puts a working `snsagent` on `PATH`).
- **Never breaks install**: any GitHub/network/rate-limit failure prints a warning and exits 0 (falls back to building from source). Only an *unexpected internal* error exits 1.

### 2. `scripts/apply-pi-natives-patch.js` - the JS-only fallback

- `@oh-my-pi/pi-natives` ships a native `.node` addon (`grep`, `pty`, `shell`, clipboard, syntax highlighting, etc.).
- A compiled Bun binary (`bun build --compile`) does **not** embed that addon, so `pi-natives`' loader would `throw` and the binary would crash on startup.
- The patch rewrites the trailing `throw new Error("Failed to load pi_natives …")` in `node_modules/@oh-my-pi/pi-natives/native/loader-state.js` into a conditional: when `ctx.isCompiledBinary`, return a no-op `Proxy` stub and print `[pi-natives] JS-only mode: …`; in plain Node it keeps the original throw.
- **Idempotent**: it detects the already-patched marker (`JS-only mode: native addon unavailable`) and skips. Bun's global cache hard-links packages into `node_modules`, so a patched file can propagate through the cache on re-install - harmless, and the postinstall still re-runs and re-verifies.

### The `patches/` directory

`patches/pi-natives-js-only-fallback.patch` is the original git-style patch kept for reference. The **active** mechanism is `scripts/apply-pi-natives-patch.js` (string replacement, idempotent), which is what `postinstall` runs.

## Reproducing a from-scratch install

```sh
rm -rf node_modules          # keep bun.lock + package-lock.json (the pins)
bun install
```

Measured result (bun 1.3.14, linux/x64, musl-detected):

- **Duration**: ~6 s (5.53 s package resolution; ~112 MB binary download included).
- **Packages**: 288 installed (Bun's deduped count; 361 `package.json` files on disk).
- **Postinstall output**:
  ```
  info  target: linux/x64 (musl)
  info  downloading snsagent-linux-x64 (111.93 MB)
  ok    snsagent-linux-x64 ready (111.93 MB) → bin/snsagent.js
  [patch] loader-state.js already fully patched, skipping.
  ```
- **Lockfiles unchanged** after install (`git status` clean for `bun.lock` / `package-lock.json`) - the install is reproducible from the committed pins.
- **Post-install verification**: `./bin/snsagent-linux-x64 --version` prints `snsagent v0.3.9` (release binary), and `bun run build` re-produces a local `bin/snsagent-linux-x64` (117 MB) that also starts; `bun test src/tbm` (74 tests) and `bunx tsc --noEmit` both pass on the fresh `node_modules`.

## Dependency drift

### `@sns-myagent/*`

| Package | Lockfile | Upstream (npm latest) | Impact | Action |
|---|---|---|---|---|
| `@sns-myagent/cli` | 0.3.9 (self) | 0.3.9 (this repo) | none | n/a - it is this package |

### `@oh-my-pi/*`

All eleven `@oh-my-pi/*` packages are pinned by the lockfiles to **16.1.18**. Upstream `latest` is **17.3.5**.

| Package | Lockfile | Upstream latest | Drift |
|---|---|---|---|
| `@oh-my-pi/hashline` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/omp-stats` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-agent-core` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-ai` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-catalog` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-mnemopi` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-natives` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-tui` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-utils` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/pi-wire` | 16.1.18 | 17.3.5 | one major |
| `@oh-my-pi/snapcompact` | 16.1.18 | 17.3.5 | one major |

**Notes**

- `package.json` declares `^16.1.18` for all of them, which resolves to `>=16.1.18 <17.0.0` - so a lockfile-ignoring install would jump to the latest **16.x** (16.5.2 at the time of writing) or to 17.x, **not** stay on 16.1.18. The committed `bun.lock` is what holds 16.1.18.
- A 16.x → 17.x bump is high-risk: it must re-validate the `pi-natives` JS-only patch against the new loader and re-run the full memory/TBM/Telegram test surface.
- See `docs/upstream.md` for the broader lineage comparison with `can1357/oh-my-pi`.

## Keeping the custom bits intact

- Do **not** delete `scripts/fetch-binary.mjs`, `scripts/apply-pi-natives-patch.js`, or `patches/` - they are part of the install contract.
- Do **not** remove the `postinstall` script from `package.json`.
- When bumping `@oh-my-pi/*`, re-run `node scripts/apply-pi-natives-patch.js` manually and confirm the binary still starts (`--version`) before committing.
