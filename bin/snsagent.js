#!/usr/bin/env node
// Auto-generated placeholder. fetch-binary.mjs will overwrite this with
// the real shim (bin/snsagent.js) that execs the platform binary.
// This placeholder exists so the npm package tarball always ships a
// valid shim at this path — npm install -g requires it (bin field).
// Without it, npm refuses to symlink `snsagent` to PATH.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Try common platform binary names (in order).
const candidates = [
	"snsagent-linux-x64",
	"snsagent-linux-arm64",
	"snsagent-darwin-x64",
	"snsagent-darwin-arm64",
	"snsagent-windows-x64.exe",
];

let binary = null;
for (const c of candidates) {
	try {
		const { statSync } = await import("node:fs");
		statSync(join(here, c));
		binary = join(here, c);
		break;
	} catch {
		continue;
	}
}

if (!binary) {
	process.stderr.write(
		`✗ snsagent: platform binary not found.\n` +
			`  Expected one of: ${candidates.join(", ")}\n` +
			`  in ${here}\n` +
			`\n` +
			`  Fix: re-run 'npm rebuild @sns-myagent/cli' to retry postinstall,\n` +
			`  or run 'curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash'.\n`,
	);
	process.exit(1);
}

const r = spawn(binary, process.argv.slice(2), { stdio: "inherit" });
r.on("exit", (c) => process.exit(c ?? 0));
