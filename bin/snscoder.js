#!/usr/bin/env node
// bin/snscoder.js — npm-installed shim that locates and spawns the
// platform-specific prebuilt binary downloaded by scripts/fetch-binary.mjs
// (or built locally via `bun scripts/build-binary.ts`).
//
// Runs on plain Node 18+. Uses spawnSync so npm postinstall script chaining
// behaves predictably and exit codes propagate correctly.

import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const platform = process.platform;
const arch = process.arch;
const isWin = platform === "win32";

const binaryName = isWin ? "snscoder.exe" : "snscoder";
const binaryPath = join(REPO_ROOT, "bin", binaryName);
const altBinaryPath = join(REPO_ROOT, "bin", `${binaryName}-${platform}-${arch}${isWin ? ".exe" : ""}`);

// Local dev fallback: if a sibling dist/omp or dist/cli.js exists (source build),
// prefer invoking the Node entry so contributors without a fetched binary still work.
const devEntryCandidates = [
	join(REPO_ROOT, "dist", "omp"), // compiled Bun binary from `bun scripts/build-binary.ts`
	join(REPO_ROOT, "dist", "cli.js"), // legacy Node entry
];

function missingHelp() {
	const lines = [
		"",
		`\u001b[31m✗ snscoder binary not found at ${binaryPath}\u001b[0m`,
		"",
		"  SNS-MyAgent ships a platform-specific prebuilt binary that is downloaded",
		"  on `npm install` (or fetched explicitly via `npm run fetch-binary`). The",
		"  binary appears to be missing from this install.",
		"",
		"  \u001b[1mFix — pick one:\u001b[0m",
		"    1. Re-run the npm postinstall step:",
		"         npm rebuild              # re-runs postinstall for current pkg",
		"         npm install -g @sns-myagent/cli --force   # full reinstall",
		"    2. Use the recommended installer (handles Bun + binary end-to-end):",
		"         curl -fsSL https://sns.myagent.id/install.sh | bash",
		"    3. Windows PowerShell:",
		"         irm raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex",
		"    4. Build from source (requires Bun >= 1.3.14):",
		"         git clone https://github.com/Reihantt6/sns-myagent",
		"         cd sns-myagent && bun install && bun run build",
		"",
		"  If a release hasn't been published yet, you will see a warning from",
		"  scripts/fetch-binary.mjs during install — that's expected and not a bug.",
		"",
	];
	process.stderr.write(lines.join("\n"));
}

function pickExecutable() {
	if (existsSync(binaryPath) && statSync(binaryPath).isFile()) {
		return { path: binaryPath, args: [] };
	}
	if (existsSync(altBinaryPath) && statSync(altBinaryPath).isFile()) {
		return { path: altBinaryPath, args: [] };
	}
	// Local dev fallback: bun build artifact or legacy Node entry.
	for (const candidate of devEntryCandidates) {
		if (existsSync(candidate) && statSync(candidate).isFile()) {
			const isNodeEntry = candidate.endsWith(".js");
			return {
				path: isNodeEntry ? process.execPath : candidate,
				args: isNodeEntry ? [candidate] : [],
			};
		}
	}
	return null;
}

const exe = pickExecutable();
if (!exe) {
	missingHelp();
	process.exit(1);
}

const result = spawnSync(exe.path, [...exe.args, ...process.argv.slice(2)], {
	stdio: "inherit",
	// Forward env so callers can still pass API keys etc. through npm-global env.
	env: process.env,
});

// Propagate signal-based termination (e.g. SIGINT from Ctrl-C) rather than
// reporting exit code 1.
if (result.signal) {
	process.exit(1);
}
process.exit(result.status ?? 1);
