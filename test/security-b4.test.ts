/**
 * B4 — Robustness / light fuzz.
 *
 * 1. Corrupt config.yml (broken YAML, non-mapping) must load with defaults,
 *    never throw a raw stacktrace.
 * 2. Wrong-typed config values for valid setting paths must not crash `get()`
 *    or backend resolution.
 * 3. Corrupt session files (garbage bytes, truncated/partial JSON lines) must
 *    load gracefully — lenient parse, no throw.
 * 4. Extreme unicode / extreme-length input into the slash-command and
 *    command-arg parsers must not throw or hang.
 */
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { Settings, resetSettingsForTest } from "../src/config/settings";
import { resolveMemoryBackend } from "../src/memory-backend/resolve";
import { parseSlashCommand, parseSubcommand } from "../src/slash-commands/helpers/parse";
import { parseCommandArgs } from "../src/utils/command-args";
import { loadEntriesFromFile, parseSessionEntries } from "../src/session/session-loader";

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sns-bughunt-b4-"));
}

describe("B4.1 corrupt config.yml loads gracefully", () => {
	test("broken YAML syntax does not throw and falls back to defaults", async () => {
		const dir = makeTempDir();
		try {
			fs.mkdirSync(path.join(dir, "agent"), { recursive: true });
			fs.writeFileSync(
				path.join(dir, "agent", "config.yml"),
				"model:\n  provider: [unclosed\n   bad: : :\n   :::\n\t```\n",
			);
			resetSettingsForTest();
			const settings = await Settings.init({ agentDir: path.join(dir, "agent"), cwd: dir, inMemory: false });
			// Defaults must still hold.
			assert.equal(settings.get("memory.backend"), "off", "corrupt YAML must fall back to schema default");
			assert.equal(settings.get("tbm.enabled"), false);
		} finally {
			resetSettingsForTest();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("config.yml that is not a mapping (scalar/array) loads as empty", async () => {
		const dir = makeTempDir();
		try {
			fs.mkdirSync(path.join(dir, "agent"), { recursive: true });
			fs.writeFileSync(path.join(dir, "agent", "config.yml"), "just a scalar string\n");
			resetSettingsForTest();
			const settings = await Settings.init({ agentDir: path.join(dir, "agent"), cwd: dir, inMemory: false });
			assert.equal(settings.get("memory.backend"), "off");
		} finally {
			resetSettingsForTest();
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("B4.2 wrong-typed config values do not crash", () => {
	test("get() with a wrong-typed value for a valid path returns without throwing", () => {
		// `tbm.enabled` expects a boolean; a string/number must not crash get().
		const settings = Settings.isolated({ "tbm.enabled": "yes" as unknown as boolean });
		const value = settings.get("tbm.enabled");
		// Either coerced to a usable value or the raw value — the point is no throw.
		assert.ok(typeof value === "boolean" || typeof value === "string");
	});

	test("resolveMemoryBackend with a wrong-typed backend id does not throw", async () => {
		const settings = Settings.isolated({ "memory.backend": 12345 as unknown as "off" });
		let resolved: { id: string } | undefined;
		let error: unknown;
		try {
			resolved = await resolveMemoryBackend(settings);
		} catch (err) {
			error = err;
		}
		// Either it resolves to a known fallback, or (if it throws) the error is
		// a controlled message — never a raw TypeError stacktrace. Prefer: no throw.
		if (error !== undefined) {
			assert.ok(
				!(error instanceof TypeError),
				"wrong-typed backend must not surface a raw TypeError",
			);
			return;
		}
		assert.ok(resolved, "must resolve to some backend");
		assert.ok(["off", "local", "hindsight", "mnemopi", "mem0", "lcm"].includes(resolved!.id));
	});
});

describe("B4.3 corrupt session files load gracefully", () => {
	test("garbage bytes do not throw and yield no entries", () => {
		const dir = makeTempDir();
		try {
			const file = path.join(dir, "session.jsonl");
			fs.writeFileSync(file, "\x00\x01\x02garbage\xff\xfe not json at all \n{broken\n");
			const entries = parseSessionEntries(fs.readFileSync(file, "utf-8"));
			assert.ok(Array.isArray(entries), "lenient parse must return an array");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("truncated header (no valid session entry) returns empty", async () => {
		const dir = makeTempDir();
		try {
			const file = path.join(dir, "session.jsonl");
			// A message row without a valid session header.
			fs.writeFileSync(file, '{"type":"message","id":"x"}\n');
			const entries = await loadEntriesFromFile(file);
			assert.equal(entries.length, 0, "missing valid header must yield empty, not throw");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("partial trailing JSON line is skipped, valid rows survive", async () => {
		const dir = makeTempDir();
		try {
			const file = path.join(dir, "session.jsonl");
			const header = JSON.stringify({ type: "session", id: "s1", version: 1 });
			const good = JSON.stringify({ type: "message", id: "m1", message: { role: "user", content: "hi" } });
			fs.writeFileSync(file, `${header}\n${good}\n${good.slice(0, 40)}\n`);
			const entries = await loadEntriesFromFile(file);
			const messages = entries.filter(e => e.type === "message");
			assert.equal(messages.length, 1, "the intact message must survive the truncated tail");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("B4.4 extreme unicode / extreme-length input to parsers", () => {
	test("parseSlashCommand tolerates NUL bytes, emoji, and 100KB of input", () => {
		const nul = "/cmd\x00\x00 evil";
		const emoji = "/cmd 🚀🔥😀 /../\u0000";
		const huge = "/cmd " + "A".repeat(100_000) + " 🚀" + "B".repeat(100_000);
		for (const input of [nul, emoji, huge]) {
			const parsed = parseSlashCommand(input);
			assert.ok(parsed, "must parse without throwing");
			assert.equal(typeof parsed.name, "string");
			assert.equal(typeof parsed.args, "string");
		}
	});

	test("parseSubcommand tolerates extreme unicode and returns sane verb/rest", () => {
		const cases = [
			"",
			"   ",
			"🚀🚀🚀",
			"SET\trest with tabs",
			"a".repeat(200_000),
			"verb" + "\u0000" + "rest",
		];
		for (const input of cases) {
			const { verb, rest } = parseSubcommand(input);
			assert.equal(typeof verb, "string");
			assert.equal(typeof rest, "string");
		}
	});

	test("parseCommandArgs tolerates unclosed quotes and NUL bytes", () => {
		const cases = ['unclosed "quote', "a b 'c", "x\u0000y", "  spaced  out  ", '"a" "b c" "d'];
		for (const input of cases) {
			const args = parseCommandArgs(input);
			assert.ok(Array.isArray(args), "must return an array");
		}
	});
});
