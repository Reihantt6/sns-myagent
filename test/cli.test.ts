/** Regression tests for CLI lifecycle and shared subprocess semantics. */

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const projectRoot = process.cwd();

describe("CLI entry", () => {
	test("version does not start Telegram polling", () => {
		const result = spawnSync(process.execPath, ["src/cli/entry.ts", "version"], {
			cwd: projectRoot,
			env: {
				...process.env,
				SNS_TELEGRAM_BOT_TOKEN: "123:invalid",
				SNS_TELEGRAM_AUTOSTART: "1",
			},
			encoding: "utf8",
			timeout: 3000,
		});

		assert.equal(result.status, 0, result.stderr);
		const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
		assert.equal(result.stdout.trim(), `snsagent ${version}`);
		assert.equal(result.stderr.includes("Unhandled Rejection"), false, result.stderr);
	});
});
