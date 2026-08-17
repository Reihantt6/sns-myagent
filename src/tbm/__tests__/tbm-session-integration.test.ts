import { describe, expect, test } from "bun:test";
import { countTokens } from "@oh-my-pi/pi-agent-core";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { Settings } from "../../config/settings";
import { estimateTokens } from "../context-delta";
import { TbmManager } from "../index";
import {
	applyTbmPreModel,
	applyTbmToolCompression,
	applyTombstone,
	cacheTbmResponse,
	cacheTbmTurnResponse,
} from "../session-hooks";
import { resolveTbmConfigFromSettings } from "../settings-bridge";

/** Minimal real-shaped message fixture (runtime role/content only). */
function msg(role: "user" | "assistant", content: string | { type: string; text?: string }[], timestamp = 0): AgentMessage {
	return { role, content, timestamp } as unknown as AgentMessage;
}

function textOf(message: AgentMessage): string {
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map(b => (b as { text?: string }).text ?? "").join("\n");
	return "";
}

describe("TBM config wiring", () => {
	test("schema default is OFF (safe default: existing loop unchanged)", () => {
		const settings = Settings.isolated({});
		expect(settings.get("tbm.enabled")).toBe(false);
		expect(resolveTbmConfigFromSettings(settings).enabled).toBe(false);
	});

	test("tbm.* settings are consumed into TbmConfig", () => {
		const settings = Settings.isolated({
			"tbm.enabled": true,
			"tbm.commMode": "caveman",
			"tbm.tombstoneAfterTurns": 2,
			"tbm.compressTerminal": 100,
		});
		const cfg = resolveTbmConfigFromSettings(settings);
		expect(cfg.enabled).toBe(true);
		expect(cfg.comm_mode).toBe("caveman");
		expect(cfg.tombstone.after_turns).toBe(2);
		expect(cfg.compress.budgets.terminal).toBe(100);
	});

	test("disabled TbmManager is a no-op pass-through", () => {
		const mgr = new TbmManager({ enabled: false });
		const messages = [msg("user", "hello"), msg("assistant", [{ type: "text", text: "hi" }])];
		const out = applyTbmPreModel(mgr, messages);
		expect(out).toBe(messages);
		expect(mgr.contextDelta.stats.turns).toBe(0);
	});
});

describe("TBM token counting is unified with the main loop", () => {
	test("estimateTokens delegates to @oh-my-pi/pi-agent-core countTokens", () => {
		for (const sample of ["hello world", "résumé café", "some longer text with symbols — fine"]) {
			expect(estimateTokens(sample)).toBe(countTokens(sample));
		}
	});
});

describe("TBM pre-model hook — observable payload effects", () => {
	test("injects the comm-mode directive and advances delta/pyramid accounting", () => {
		const mgr = new TbmManager({
			enabled: true,
			context_delta: { enabled: true },
			pyramid: { enabled: true, start_level: 1, max_level: 4 },
			tombstone: { enabled: false, after_turns: 20, keep_recent: 5 },
		});
		const out = applyTbmPreModel(mgr, [msg("user", "explain in detail why the auth middleware fails")]);
		expect(out[0].role).toBe("developer");
		expect(mgr.contextDelta.stats.turns).toBe(1);
		expect(mgr.pyramid.level).toBeGreaterThanOrEqual(1);
	});

	test("tombstone replaces old plain-text messages; originals do not re-enter verbatim", () => {
		const mgr = new TbmManager({ enabled: true, tombstone: { enabled: true, after_turns: 1, keep_recent: 1 } });
		const longOriginal = "first user message " + "with lots of detail ".repeat(30); // > 150 chars
		const messages = [
			msg("user", longOriginal),
			msg("assistant", [{ type: "text", text: "first assistant response ".repeat(20) }]),
			msg("user", "second user message"),
			msg("assistant", [{ type: "text", text: "second assistant response" }]),
		];
		const out = applyTombstone(mgr, messages);

		const eligible = out.filter(m => m.role === "user" || m.role === "assistant");
		expect(eligible.length).toBe(messages.length);

		// The first eligible message is now a tombstone line, not the raw content.
		expect(textOf(eligible[0])).toMatch(/^\[Turn \d+ - user\]/);
		// The truncated tail of the long original must not re-enter the context.
		expect(textOf(eligible[0]).length).toBeLessThan(longOriginal.length);
		// The kept (recent) message is untouched.
		expect(textOf(eligible[eligible.length - 1])).toBe("second assistant response");
		// Tombstone stats advanced.
		expect(mgr.tombstoner.stats.messagesTombstoned).toBeGreaterThan(0);
	});

	test("does not tombstone tool-call / structured assistant messages", () => {
		const mgr = new TbmManager({ enabled: true, tombstone: { enabled: true, after_turns: 1, keep_recent: 1 } });
		const messages = [
			msg("user", "old user text"),
			// assistant with a tool-call block must be skipped (unsafe to tombstone)
			{ role: "assistant", content: [{ type: "toolCall", id: "t1", name: "bash", arguments: {} }], timestamp: 2 } as unknown as AgentMessage,
			msg("user", "recent user text"),
			msg("assistant", [{ type: "text", text: "recent assistant text" }]),
		];
		const out = applyTombstone(mgr, messages);
		// The tool-call assistant message is preserved verbatim.
		const toolMsg = out.find(m => m.role === "assistant" && Array.isArray((m as { content?: unknown }).content) && ((m as { content: unknown[] }).content[0] as { type?: string }).type === "toolCall");
		expect(toolMsg).toBeDefined();
	});
});

describe("TBM post-tool hook — tool output compression", () => {
	test("truncates oversized tool output and marks it compressed", () => {
		const mgr = new TbmManager({
			enabled: true,
			compress: {
				enabled: true,
				budgets: { terminal: 50, read_file: 800, web_extract: 1000, search_files: 300, default: 50 },
			},
		});
		const big = "x".repeat(1000);
		const out = applyTbmToolCompression(mgr, "terminal", [{ type: "text", text: big }]);
		expect(out).toBeDefined();
		const text = (out![0] as { text: string }).text;
		expect(text.length).toBeLessThan(big.length);
		expect(text).toContain("compressed");
		expect(mgr.compressor.stats.compressed).toBeGreaterThan(0);
	});

	test("leaves short tool output untouched", () => {
		const mgr = new TbmManager({ enabled: true });
		const out = applyTbmToolCompression(mgr, "terminal", [{ type: "text", text: "hi" }]);
		expect(out).toBeUndefined();
	});

	test("is a no-op when TBM is disabled", () => {
		const mgr = new TbmManager({ enabled: false });
		const big = "x".repeat(1000);
		expect(applyTbmToolCompression(mgr, "terminal", [{ type: "text", text: big }])).toBeUndefined();
	});
});

describe("TBM post-turn hook — response cache", () => {
	test("caches the finished turn's query/response pair", () => {
		const mgr = new TbmManager({ enabled: true, response_cache: { enabled: true, ttl_seconds: 3600, max_entries: 100, similarity_threshold: 0.95 } });
		cacheTbmTurnResponse(mgr, [
			msg("user", "what is the capital of france"),
			msg("assistant", [{ type: "text", text: "Paris" }]),
		]);
		const hit = mgr.responseCache.get("what is the capital of france");
		expect(hit.hit).toBe(true);
		expect(hit.response).toBe("Paris");
	});

	test("cacheTbmResponse ignores empty query/response", () => {
		const mgr = new TbmManager({ enabled: true });
		cacheTbmResponse(mgr, "", "");
		cacheTbmResponse(mgr, "query", "");
		expect(mgr.responseCache.stats.cacheSize).toBe(0);
	});
});
