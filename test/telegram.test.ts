/**
 * Tests for the Telegram adapter.
 *
 * We do NOT spin up a real polling loop (that needs a real bot token).
 * We mock the underlying `Bot` API to verify:
 *   - markdownToTelegram converts `**bold**` → `*bold*` and `~~strike~~` → `~strike~`
 *   - parseMessage recognises `/start`, `/help`, `/chat <msg>`, plain text, empty
 *   - TelegramBot.sendMessage chunks long replies correctly
 *   - handleMessage round-trip: incoming text → outgoing reply
 */

import { strict as assert } from "node:assert";
import { describe, test, before, after } from "node:test";
import type { Message } from "grammy/types";

import {
	TelegramBot,
	chunkText,
	markdownToTelegram,
	stripMarkdown,
	parseMessage,
	resolveReply,
} from "../src/adapters/telegram/index";

// --- markdownToTelegram ---------------------------------------------------

describe("markdownToTelegram", () => {
	test("converts **bold** to *bold*", () => {
		const out = markdownToTelegram("**hello**");
		assert.equal(out, "*hello*");
	});

	test("converts ~~strike~~ to ~strike~", () => {
		const out = markdownToTelegram("~~gone~~");
		assert.equal(out, "~gone~");
	});

	test("escapes special chars outside delimiters", () => {
		const out = markdownToTelegram("hello. world!");
		assert.equal(out, "hello\\. world\\!");
	});

	test("preserves inline code (only ` and \\ escaped)", () => {
		// Per Telegram docs: inside code entities, only ` and \ are special.
		const out = markdownToTelegram("use `arr.length` here");
		assert.equal(out, "use `arr.length` here");
	});

	test("preserves inline links (only ) and \\ escaped in URL)", () => {
		const out = markdownToTelegram("[docs](https://example.com)");
		assert.equal(out, "[docs](https://example.com)");
	});

	test("preserves fenced code blocks", () => {
		const out = markdownToTelegram("```\nlet x = 1;\n```");
		assert.ok(out.startsWith("```"));
		assert.ok(out.endsWith("```"));
		assert.ok(out.includes("let x = 1;"));
	});

	test("converts # heading to bold", () => {
		const out = markdownToTelegram("# Title");
		assert.equal(out, "*Title*");
	});

	test("unclosed delimiter triggers escape-everything safety net", () => {
		const out = markdownToTelegram("one * two ** three");
		// Odd-numbered `*` → safety net escapes everything.
		assert.ok(out.includes("\\*"), `expected escaped asterisks, got: ${out}`);
	});

	test("empty input returns empty string", () => {
		assert.equal(markdownToTelegram(""), "");
	});

	test("escapes underscores inside bold text", () => {
		const out = markdownToTelegram("**file_name**");
		// Bold delimiter preserved, inner `_` is escaped per MarkdownV2 rules.
		assert.equal(out, "*file\\_name*");
	});
});

describe("stripMarkdown", () => {
	test("strips bold", () => {
		assert.equal(stripMarkdown("**hello**"), "hello");
	});
	test("strips strikethrough", () => {
		assert.equal(stripMarkdown("~~gone~~"), "gone");
	});
	test("strips inline code", () => {
		assert.equal(stripMarkdown("`x = 1`"), "x = 1");
	});
	test("strips inline link, keeps label", () => {
		assert.equal(stripMarkdown("[click](https://x)"), "click (https://x)");
	});
});

// --- parseMessage --------------------------------------------------------

function makeMessage(text: string, opts: { fromId?: number; chatId?: number } = {}): Message {
	return {
		message_id: 1,
		date: 0,
		chat: { id: opts.chatId ?? 100, type: "private" } as Message["chat"],
		from: { id: opts.fromId ?? 42, is_bot: false, first_name: "tester" } as Message["from"],
		text,
	} as unknown as Message;
}

describe("parseMessage", () => {
	test("recognises /start", () => {
		const parsed = parseMessage(makeMessage("/start"));
		assert.equal(parsed.kind, "command");
		if (parsed.kind === "command") assert.equal(parsed.command, "start");
	});

	test("recognises /start@botname", () => {
		const parsed = parseMessage(makeMessage("/start@snscoder_bot"));
		assert.equal(parsed.kind, "command");
		if (parsed.kind === "command") assert.equal(parsed.command, "start");
	});

	test("recognises /chat with args", () => {
		const parsed = parseMessage(makeMessage("/chat hello world"));
		assert.equal(parsed.kind, "command");
		if (parsed.kind === "command") {
			assert.equal(parsed.command, "chat");
			assert.equal(parsed.args, "hello world");
		}
	});

	test("recognises /help /reset /status", () => {
		for (const cmd of ["help", "reset", "status"] as const) {
			const parsed = parseMessage(makeMessage(`/${cmd}`));
			assert.equal(parsed.kind, "command");
			if (parsed.kind === "command") assert.equal(parsed.command, cmd);
		}
	});

	test("unknown command is treated as chat", () => {
		const parsed = parseMessage(makeMessage("/nope hello"));
		assert.equal(parsed.kind, "chat");
		if (parsed.kind === "chat") assert.equal(parsed.text, "/nope hello");
	});

	test("plain text is chat", () => {
		const parsed = parseMessage(makeMessage("hello there"));
		assert.equal(parsed.kind, "chat");
		if (parsed.kind === "chat") {
			assert.equal(parsed.text, "hello there");
			assert.equal(parsed.userId, 42);
			assert.equal(parsed.chatId, 100);
		}
	});

	test("empty payload → kind: empty", () => {
		const parsed = parseMessage(makeMessage(""));
		assert.equal(parsed.kind, "empty");
	});
});

// --- resolveReply -------------------------------------------------------

describe("resolveReply", () => {
	test("/start returns welcome banner", async () => {
		const parsed = parseMessage(makeMessage("/start"));
		const reply = await resolveReply(parsed, { sessionKey: "1" });
		assert.ok(reply.includes("Welcome"));
	});

	test("/help lists commands", async () => {
		const parsed = parseMessage(makeMessage("/help"));
		const reply = await resolveReply(parsed, { sessionKey: "1" });
		assert.ok(reply.includes("/start"));
		assert.ok(reply.includes("/chat"));
	});

	test("plain text echoes via stub when no forwardToAgent", async () => {
		const parsed = parseMessage(makeMessage("hello world"));
		const reply = await resolveReply(parsed, { sessionKey: "100" });
		assert.ok(reply.includes("hello world"));
	});

	test("plain text routes through forwardToAgent", async () => {
		const parsed = parseMessage(makeMessage("build me a CLI"));
		const reply = await resolveReply(parsed, {
			sessionKey: "100",
			forwardToAgent: async (text, session) => `[real-agent ${session}] ${text}`,
		});
		assert.equal(reply, "[real-agent 100] build me a CLI");
	});

	test("/chat with args forwards to agent", async () => {
		const parsed = parseMessage(makeMessage("/chat write a poem"));
		const reply = await resolveReply(parsed, {
			sessionKey: "100",
			forwardToAgent: async (text) => `agent-says:${text}`,
		});
		assert.equal(reply, "agent-says:write a poem");
	});
});

// --- chunkText ---------------------------------------------------------

describe("chunkText", () => {
	test("returns single chunk when under limit", () => {
		const chunks = chunkText("short text", 100);
		assert.deepEqual(chunks, ["short text"]);
	});

	test("splits on newline when over limit", () => {
		const text = "a".repeat(50) + "\n" + "b".repeat(50) + "\n" + "c".repeat(50);
		const chunks = chunkText(text, 60);
		assert.ok(chunks.length >= 2);
		for (const c of chunks) assert.ok(c.length <= 60);
	});

	test("handles no-newline case via space fallback", () => {
		const text = "word ".repeat(200);
		const chunks = chunkText(text, 100);
		assert.ok(chunks.length > 1);
		for (const c of chunks) assert.ok(c.length <= 100);
	});
});

// --- TelegramBot with mocked grammY -----------------------------------

interface RecordedCall {
	method: string;
	args: unknown[];
}

function createMockBot(): {
	bot: TelegramBot;
	calls: RecordedCall[];
	triggerMessage: (msg: Message) => Promise<void>;
} {
	const calls: RecordedCall[] = [];

	const bot = new TelegramBot({
		token: "TEST:TOKEN",
		sessionStore: new Map(),
	});

	const api = bot.raw.api as unknown as {
		sendMessage: (chatId: number, text: string, opts?: unknown) => Promise<{ message_id: number }>;
	};
	api.sendMessage = async (chatId: number, text: string, opts?: unknown) => {
		calls.push({ method: "sendMessage", args: [chatId, text, opts] });
		return { message_id: calls.length };
	};

	async function triggerMessage(msg: Message): Promise<void> {
		const ctx = {
			message: msg,
			reply: async (text: string, opts?: unknown) => {
				calls.push({ method: "reply", args: [text, opts] });
				return { message_id: calls.length };
			},
		} as unknown as Parameters<typeof bot.__handleUpdateForTests>[0];
		await bot.__handleUpdateForTests(ctx);
	}

	return { bot, calls, triggerMessage };
}

describe("TelegramBot (mocked)", () => {
	let mock: ReturnType<typeof createMockBot>;
	before(() => {
		mock = createMockBot();
	});
	after(async () => {
		await mock.bot.stop();
	});

	test("sendMessage sends one chunk under limit", async () => {
		mock.calls.length = 0;
		const id = await mock.bot.sendMessage(100, "hi there");
		assert.equal(typeof id, "number");
		assert.ok(mock.calls.some((c) => c.method === "sendMessage"));
	});

	test("sendMessage chunks long messages", async () => {
		mock.calls.length = 0;
		const long = "x".repeat(5000);
		const id = await mock.bot.sendMessage(100, long);
		assert.equal(typeof id, "number");
		const sends = mock.calls.filter((c) => c.method === "sendMessage");
		assert.ok(sends.length >= 2, `expected >=2 sendMessage calls, got ${sends.length}`);
	});

	test("incoming /start triggers a reply with welcome", async () => {
		mock.calls.length = 0;
		const msg = makeMessage("/start", { chatId: 999 });
		await mock.triggerMessage(msg);
		const reply = mock.calls.find((c) => c.method === "reply");
		assert.ok(reply, "expected a reply call");
		const text = reply.args[0] as string;
		assert.ok(text.includes("Welcome"));
	});

	test("incoming plain text is stub-echoed", async () => {
		mock.calls.length = 0;
		const msg = makeMessage("ping", { chatId: 888 });
		await mock.triggerMessage(msg);
		const reply = mock.calls.find((c) => c.method === "reply");
		assert.ok(reply, "expected a reply call");
		const text = reply.args[0] as string;
		assert.ok(text.includes("ping"));
	});

	test("started is false before start() is called", () => {
		const b = new TelegramBot({ token: "T" });
		assert.equal(b.started, false);
	});
});

describe("token-required constructor", () => {
	test("throws when token is empty", () => {
		assert.throws(() => new TelegramBot({ token: "" }));
	});
});