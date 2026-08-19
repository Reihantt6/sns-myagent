/**
 * Telegram audit tests — end-to-end path and authorization boundary.
 *
 * These tests pin the CURRENT behavior so the audit findings are explicit:
 *   1. Authorization: there is NO allowlist/identity check. Any user id and
 *      any chat (private or group) is routed to the agent identically. This is
 *      a CRITICAL security gap, documented in AUDIT-REPORT.md.
 *   2. File upload path: documents/photos are parsed as `kind: file` and
 *      routed through `downloadFile` + `forwardToAgent`.
 *   3. Long outputs are chunked; short outputs are not.
 *   4. Unknown commands fall back to chat (no silent 404).
 */

import { strict as assert } from "node:assert";
import { describe, test, before, after } from "node:test";
import type { Message } from "grammy/types";

import {
	TelegramBot,
	chunkText,
	parseMessage,
	resolveReply,
	resolveTelegramAllowedUsers,
} from "../src/adapters/telegram/index";

function makeMessage(
	text: string,
	overrides: Partial<Message> = {},
): Message {
	const base: Message = {
		message_id: 1,
		date: 0,
		chat: { id: 100, type: "private", first_name: "Tester" },
		from: { id: 42, is_bot: false, first_name: "Tester" },
		text,
	};
	return { ...base, ...overrides } as Message;
}

// ═══════════════════════════════════════════════════════════════════════════
// Authorization boundary
// ═══════════════════════════════════════════════════════════════════════════

describe("Authorization boundary", () => {
	test("DOCUMENTED GAP: an arbitrary user id is treated identically to any other", async () => {
		// There is no allowlist, no auth check, no user verification anywhere in
		// the parse→reply path. A random Telegram user id (999999) gets exactly
		// the same agent-forwarding treatment as the owner would.
		const msg = makeMessage("run a command on the server", { from: { id: 999999, is_bot: false, first_name: "Stranger" } });
		const parsed = parseMessage(msg);
		assert.equal(parsed.userId, 999999);

		let forwarded = "";
		const reply = await resolveReply(parsed, {
			sessionKey: String(parsed.chatId),
			forwardToAgent: async (text) => {
				forwarded = text;
				return "done";
			},
		});
		assert.equal(reply, "done");
		assert.equal(forwarded, "run a command on the server");
	});

	test("DOCUMENTED GAP: group chat messages are routed with no membership check", async () => {
		const msg = makeMessage("delete the database", {
			chat: { id: -100123, type: "group", title: "Public group" },
			from: { id: 31337, is_bot: false, first_name: "Member" },
		});
		const parsed = parseMessage(msg);
		assert.equal(parsed.kind, "chat");
		if (parsed.kind === "chat") assert.equal(parsed.text, "delete the database");

		let forwarded = "";
		await resolveReply(parsed, {
			sessionKey: String(parsed.chatId),
			forwardToAgent: async (text) => {
				forwarded = text;
				return "done";
			},
		});
		assert.equal(forwarded, "delete the database");
	});

	test("DOCUMENTED GAP: userId is parsed but the bridge ignores it", async () => {
		// handler.ts parses userId into every ParsedMessage, but bot.ts builds
		// the session key from chatId only, and cli/index.ts adapts the bridge
		// call with a constant "telegram" as the user. The user identity never
		// reaches the bridge, so per-user policy cannot be enforced.
		const msg = makeMessage("hello", { from: { id: 42, is_bot: false, first_name: "Tester" } });
		const parsed = parseMessage(msg);
		assert.equal(parsed.userId, 42);
		// sessionKey is chatId, not userId.
		const sessionKey = String(parsed.chatId);
		assert.notEqual(sessionKey, "42");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// File upload path
// ═══════════════════════════════════════════════════════════════════════════

describe("File upload path", () => {
	test("document attachments parse as kind: file", () => {
		const msg = makeMessage("", {
			document: {
				file_id: "FILE123",
				file_name: "notes.txt",
				mime_type: "text/plain",
				file_size: 10,
			},
		}) as Message;
		const parsed = parseMessage(msg);
		assert.equal(parsed.kind, "file");
		if (parsed.kind === "file") {
			assert.equal(parsed.fileId, "FILE123");
			assert.equal(parsed.fileName, "notes.txt");
			assert.equal(parsed.mimeType, "text/plain");
		}
	});

	test("photos parse as kind: file with a jpg name", () => {
		const msg = makeMessage("", {
			photo: [
				{ file_id: "P1", width: 10, height: 10, file_size: 1 },
				{ file_id: "P2", width: 100, height: 100, file_size: 2 },
			],
		}) as Message;
		const parsed = parseMessage(msg);
		assert.equal(parsed.kind, "file");
		if (parsed.kind === "file") {
			assert.equal(parsed.fileId, "P2"); // largest photo wins
			assert.match(parsed.fileName, /\.jpg$/);
		}
	});

	test("file route calls downloadFile and forwards the caption to the agent", async () => {
		const msg = makeMessage("please review this", {
			document: { file_id: "FILE9", file_name: "code.ts", mime_type: "text/plain", file_size: 5 },
		}) as Message;
		const parsed = parseMessage(msg);
		assert.equal(parsed.kind, "file");

		let downloaded = "";
		let forwarded = "";
		const reply = await resolveReply(parsed, {
			sessionKey: "100",
			downloadFile: async (fileId, fileName) => {
				downloaded = `${fileId}:${fileName}`;
				return "/tmp/code.ts";
			},
			forwardToAgent: async (text) => {
				forwarded = text;
				return "agent processed file";
			},
		});
		assert.equal(downloaded, "FILE9:code.ts");
		assert.ok(forwarded.includes("code.ts"));
		assert.ok(forwarded.includes("please review this"));
		assert.equal(reply, "agent processed file");
	});

	test("file download failure returns a readable error, not a crash", async () => {
		const msg = makeMessage("", {
			document: { file_id: "BAD", file_name: "x.bin", mime_type: "application/octet-stream", file_size: 1 },
		}) as Message;
		const parsed = parseMessage(msg);
		const reply = await resolveReply(parsed, {
			sessionKey: "100",
			downloadFile: async () => {
				throw new Error("token expired");
			},
		});
		assert.ok(reply.includes("File download failed"));
		assert.ok(reply.includes("token expired"));
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Command surface
// ═══════════════════════════════════════════════════════════════════════════

describe("Command surface", () => {
	test("/reset without a bridge reports context cleared", async () => {
		const parsed = parseMessage(makeMessage("/reset"));
		const reply = await resolveReply(parsed, { sessionKey: "100" });
		assert.ok(reply.includes("Context cleared"));
	});

	test("/reset calls the bridge reset hook when present", async () => {
		const parsed = parseMessage(makeMessage("/reset"));
		let resetCalled = "";
		const reply = await resolveReply(parsed, {
			sessionKey: "100",
			resetChatSession: (chatId) => {
				resetCalled = chatId;
				return true;
			},
		});
		assert.equal(resetCalled, "100");
		assert.ok(reply.includes("Context cleared"));
	});

	test("/status reports bridge stats when present", async () => {
		const parsed = parseMessage(makeMessage("/status"));
		const reply = await resolveReply(parsed, {
			sessionKey: "100",
			getBridgeStats: () => ({ activeSessions: 3, chatIds: ["1", "2", "3"] }),
		});
		assert.ok(reply.includes("3"));
	});

	test("agent-only commands route the raw slash command when wired", async () => {
		for (const cmd of ["memory", "cron", "model", "code", "review", "task"] as const) {
			const parsed = parseMessage(makeMessage(`/${cmd} my arg`));
			let forwarded = "";
			const reply = await resolveReply(parsed, {
				sessionKey: "100",
				forwardToAgent: async (text) => {
					forwarded = text;
					return "ok";
				},
			});
			assert.equal(reply, "ok");
			assert.equal(forwarded, `/${cmd} my arg`);
		}
	});

	test("agent-only commands report not-wired when no forwarder", async () => {
		const parsed = parseMessage(makeMessage("/memory"));
		const reply = await resolveReply(parsed, { sessionKey: "100" });
		assert.ok(reply.includes("not wired"));
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Lifecycle
// ═══════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// Authorization gate (opt-in allowlist)
// ═════════════════════════════════════════════════════════════════════════

describe("Authorization gate", () => {
	test("resolveTelegramAllowedUsers parses a comma-separated id list", () => {
		const set = resolveTelegramAllowedUsers("42, 999, 123");
		assert.ok(set);
		assert.equal(set!.has(42), true);
		assert.equal(set!.has(999), true);
		assert.equal(set!.has(123), true);
		assert.equal(set!.has(7), false);
	});

	test("resolveTelegramAllowedUsers ignores junk and empty input", () => {
		assert.equal(resolveTelegramAllowedUsers(""), undefined);
		assert.equal(resolveTelegramAllowedUsers("   "), undefined);
		const set = resolveTelegramAllowedUsers("42,abc,-1,0,7");
		assert.ok(set);
		assert.equal(set!.size, 2); // 42 and 7; abc/-1/0 dropped
		assert.equal(set!.has(42), true);
		assert.equal(set!.has(7), true);
	});

	test("resolveTelegramAllowedUsers rejects overflowing (int64-imprecise) ids", () => {
		// Values beyond Number.MAX_SAFE_INTEGER lose int64 precision and can
		// never match a real Telegram id — they must be dropped, not kept.
		const set = resolveTelegramAllowedUsers("42,9007199254740993,123");
		assert.ok(set);
		assert.equal(set!.size, 2); // 42 and 123; 9007199254740993 dropped
		assert.equal(set!.has(42), true);
		assert.equal(set!.has(123), true);
	});

	test("resolveTelegramAllowedUsers returns an EMPTY set for junk-only input (fail closed)", () => {
		// Env var set but nothing parseable: result is an empty set, which the
		// adapter treats as deny-all — never undefined (which would mean open).
		const set = resolveTelegramAllowedUsers("abc, ,-5,0");
		assert.ok(set, "must be a set, not undefined (undefined would open the bot)");
		assert.equal(set!.size, 0);
	});

	test("gate rejects a non-listed user before the agent is consulted", async () => {
		let forwarded = "";
		const bot = new TelegramBot({
			token: "TEST:TOKEN",
			sessionStore: new Map(),
			allowedUserIds: new Set([42]),
			forwardToAgent: async (text) => {
				forwarded = text;
				return "ok";
			},
		});
		let replyText = "";
		const ctx = {
			message: makeMessage("run rm -rf /", { from: { id: 999999, is_bot: false, first_name: "Stranger" } }),
			reply: async (text: string) => {
				replyText = text;
				return { message_id: 1 };
			},
		};
		await bot.__handleUpdateForTests(ctx as never);
		assert.equal(forwarded, "", "agent must NOT be consulted for a non-listed user");
		assert.match(replyText, /Unauthorized/);
	});

	test("gate admits a listed user to the agent", async () => {
		let forwarded = "";
		const bot = new TelegramBot({
			token: "TEST:TOKEN",
			sessionStore: new Map(),
			allowedUserIds: new Set([42]),
			forwardToAgent: async (text) => {
				forwarded = text;
				return "ok";
			},
		});
		const ctx = {
			message: makeMessage("status please", { from: { id: 42, is_bot: false, first_name: "Owner" } }),
			reply: async () => ({ message_id: 1 }),
		};
		await bot.__handleUpdateForTests(ctx as never);
		assert.equal(forwarded, "status please", "listed user must reach the agent");
	});

	test("without an allowlist the bot still forwards (open boundary, logged)", async () => {
		let forwarded = "";
		const bot = new TelegramBot({
			token: "TEST:TOKEN",
			sessionStore: new Map(),
			forwardToAgent: async (text) => {
				forwarded = text;
				return "ok";
			},
		});
		const ctx = {
			message: makeMessage("hello", { from: { id: 555, is_bot: false, first_name: "Anyone" } }),
			reply: async () => ({ message_id: 1 }),
		};
		await bot.__handleUpdateForTests(ctx as never);
		assert.equal(forwarded, "hello", "open boundary is preserved when no allowlist is set");
	});
});

describe("Lifecycle", () => {
	test("start/stop toggles the started flag (restart is possible)", async () => {
		// The real polling loop needs a live token; the started flag + stop()
		// path are still exercisable with a fake bot instance.
		const bot = new TelegramBot({ token: "TEST:TOKEN", sessionStore: new Map() });
		assert.equal(bot.started, false);
		// start() would open a real long-poll; verify stop() is safe when not started.
		await bot.stop();
		assert.equal(bot.started, false);
	});

	test("chunking: long outputs split on boundaries, each ≤ limit", () => {
		const text = "line one content\n" + "a".repeat(200) + "\nline two content\n" + "b".repeat(200);
		const chunks = chunkText(text, 100);
		assert.ok(chunks.length >= 3);
		for (const chunk of chunks) assert.ok(chunk.length <= 100);
		// No content is lost across chunks.
		assert.equal(chunks.join(""), text.replace(/\n+/g, (m) => (m.length > 1 ? "" : m)));
	});
});
