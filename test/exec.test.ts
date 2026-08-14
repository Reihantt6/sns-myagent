/** Regression tests for shared extension subprocess semantics. */

import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { execCommand } from "../src/exec/exec";

const projectRoot = process.cwd();

describe("execCommand", () => {
	test("does not report an aborted command as successful", async () => {
		const controller = new AbortController();
		const command = execCommand("sh", ["-c", "sleep 5"], projectRoot, {
			signal: controller.signal,
		});
		setTimeout(() => controller.abort(), 25);

		const result = await command;
		assert.equal(result.killed, true);
		assert.notEqual(result.code, 0);
		assert.equal(result.code, 1);
	});
});
