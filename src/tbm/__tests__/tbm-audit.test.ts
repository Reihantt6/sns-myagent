/**
 * TBM expanded audit tests — gaps not covered by tbm.test.ts.
 *
 * These tests verify *semantic* behavior, not just "function was called":
 * - tool-output compression preserves meaning for git diffs, logs, JSON, errors
 * - response cache invalidation and the stale-cache boundary
 * - dashboard numbers correspond to real subsystem counters
 * - tombstoned messages never re-enter active context
 * - pyramid resolution levels change payloads and preserve essentials
 * - unused lazy skills stay unloaded
 */

import { describe, expect, it } from "vitest";

import { ContextDeltaCache } from "../context-delta";
import { ContextPyramid } from "../context-pyramid";
import { LazySkillLoader, type SkillEntry } from "../lazy-skills";
import { ToolOutputCompressor } from "../tool-compress";
import { ConversationTombstoner } from "../tombstone";
import { ResponseCache } from "../response-cache";
import { buildDashboard, renderDashboard } from "../dashboard";
import { TbmManager } from "../index";
import { DEFAULT_TBM_CONFIG } from "../config";

// ═══════════════════════════════════════════════════════════════════════════
// Tool-output compression — semantic preservation
// ═══════════════════════════════════════════════════════════════════════════

describe("ToolOutputCompressor — semantic preservation", () => {
	const compressor = () => new ToolOutputCompressor(DEFAULT_TBM_CONFIG.compress.budgets);

	it("keeps a git diff's head and tail semantics when compressed", () => {
		const diffLines: string[] = [];
		for (let i = 0; i < 400; i++) {
			diffLines.push(`diff --git a/file-${i}.ts b/file-${i}.ts`);
			diffLines.push(`--- a/file-${i}.ts`);
			diffLines.push(`+++ b/file-${i}.ts`);
			diffLines.push(`@@ -1,3 +1,3 @@`);
			diffLines.push(`-const old${i} = 1;`);
			diffLines.push(`+const new${i} = 2;`);
			diffLines.push(` const shared${i} = 3;`);
		}
		const bigDiff = diffLines.join("\n");

		const result = compressor().compress("terminal", bigDiff);

		expect(result.compressed).toBe(true);
		// Head preserved: first diff header still visible.
		expect(result.output).toContain("diff --git a/file-0.ts");
		// Tail preserved: last hunk still visible.
		expect(result.output).toContain("diff --git a/file-399.ts");
		expect(result.output).toContain("const shared399");
		// The compression marker is present so the model knows content was cut.
		expect(result.output).toContain("tokens compressed");
	});

	it("keeps the PASS/FAIL summary of a large test log", () => {
		const lines: string[] = [];
		for (let i = 0; i < 500; i++) {
			lines.push(`[12:00:0${i % 10}] test suite ${i} running with fixtures`);
		}
		lines.push("PASS 89 tests");
		lines.push("FAIL 2 tests");
		const log = lines.join("\n");

		const result = compressor().compress("terminal", log);

		expect(result.compressed).toBe(true);
		expect(result.output).toContain("PASS 89 tests");
		expect(result.output).toContain("FAIL 2 tests");
	});

	it("preserves the structural edges of a large JSON blob", () => {
		const entries: string[] = [];
		for (let i = 0; i < 300; i++) {
			entries.push(`"key${i}": { "value": ${i}, "status": "ok" }`);
		}
		const json = `{\n  ${entries.join(",\n  ")}\n}`;

		const result = compressor().compress("read_file", json);

		expect(result.compressed).toBe(true);
		// Opening and closing braces must survive so the model can still parse intent.
		expect(result.output.trim().startsWith("{")).toBe(true);
		expect(result.output.trimEnd().endsWith("}")).toBe(true);
		expect(result.output).toContain('"key0"');
		expect(result.output).toContain('"key299"');
	});

	it("keeps the actual error message at the head of a long error output", () => {
		const stackLines: string[] = ["TypeError: Cannot read properties of undefined (reading 'x')"];
		for (let i = 0; i < 300; i++) {
			stackLines.push(`    at fn${i} (/project/src/module-${i}.ts:12:34)`);
		}
		const error = stackLines.join("\n");

		const result = compressor().compress("terminal", error);

		expect(result.compressed).toBe(true);
		expect(result.output).toContain("TypeError: Cannot read properties of undefined");
	});

	it("leaves short outputs untouched", () => {
		const result = compressor().compress("terminal", "ok");

		expect(result.compressed).toBe(false);
		expect(result.output).toBe("ok");
		expect(result.tokensSaved).toBe(0);
	});

	it("reports truthful per-tool stats after mixed compression", () => {
		const tool = compressor();
		tool.compress("terminal", "x".repeat(5000));
		tool.compress("terminal", "short");
		tool.compress("search_files", "y".repeat(3000));

		expect(tool.stats.totalOutputs).toBe(3);
		expect(tool.stats.compressed).toBe(2);
		expect(tool.stats.perTool.terminal?.compressed).toBe(1);
		expect(tool.stats.perTool.search_files?.compressed).toBe(1);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Response cache — invalidation and the stale-cache boundary
// ═══════════════════════════════════════════════════════════════════════════

describe("ResponseCache — invalidation and staleness", () => {
	it("first request misses, identical request hits (documented behavior)", () => {
		const cache = new ResponseCache(3600, 100, 0.95);
		expect(cache.get("same query")).toEqual({ hit: false });

		cache.set("same query", "answer");
		expect(cache.get("same query")).toMatchObject({ hit: true, matchType: "exact" });
	});

	it("semantic match fires only with a lowered threshold (Jaccard bigrams)", () => {
		// Jaccard on word bigrams: two near-identical phrasings score ~0.8, so
		// the DEFAULT threshold (0.95) effectively never fires semantic hits —
		// only near-exact text does. This pins that limitation explicitly.
		const strict = new ResponseCache(3600, 100, 0.95);
		strict.set("deploy the app to production", "deployment guide");
		expect(strict.get("deploy the app to production please").hit).toBe(false);

		const lenient = new ResponseCache(3600, 100, 0.6);
		lenient.set("deploy the app to production", "deployment guide");
		const hit = lenient.get("deploy the app to production please");
		expect(hit.hit).toBe(true);
		expect(hit.matchType).toBe("semantic");
	});

	it("single-word queries never match semantically (false-positive guard)", () => {
		// Previously ANY two single-word queries compared as identical (both
		// empty bigram sets → similarity 1.0), so `get("status")` returned a
		// semantic hit for a `deploy` entry. Single-word prompts must only hit
		// via the exact-match path.
		const cache = new ResponseCache(3600, 100, 0.95);
		cache.set("deploy", "deployment guide");
		expect(cache.get("status")).toEqual({ hit: false });
		expect(cache.get("deploy")).toMatchObject({ hit: true, matchType: "exact" });

		// Same protection even with a lenient threshold.
		const lenient = new ResponseCache(3600, 100, 0.1);
		lenient.set("deploy", "deployment guide");
		expect(lenient.get("status").hit).toBe(false);
	});

	it("re-setting the same query invalidates the old response", () => {
		const cache = new ResponseCache();
		cache.set("q", "old answer");
		cache.set("q", "new answer");
		expect(cache.get("q")).toMatchObject({ response: "new answer" });
	});

	it("clear() removes every entry (invalidation path)", () => {
		const cache = new ResponseCache();
		cache.set("q1", "a1");
		cache.set("q2", "a2");
		cache.clear();
		expect(cache.stats.cacheSize).toBe(0);
		expect(cache.get("q1")).toEqual({ hit: false });
		expect(cache.get("q2")).toEqual({ hit: false });
	});

	it("DOCUMENTED LIMITATION: the cache key is query-only, so tool-state changes still hit", () => {
		// The audit task asks whether a changed context/tool state produces a miss.
		// Current implementation: the key is ONLY the query text. A different tool
		// state (e.g. files changed on disk) does not participate in the key, so
		// the cached response is returned even though the world changed. This test
		// pins that behavior so the limitation is explicit, not silent.
		const cache = new ResponseCache(3600, 100, 0.95);
		cache.set("list the files", "old file list");

		const hit = cache.get("list the files");
		expect(hit.hit).toBe(true);
		expect(hit.response).toBe("old file list");
		// Mitigation note: callers must clear()/reset() on state-changing events
		// (compaction, tool mutations) or the cached answer goes stale.
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Tombstoning — no re-entry into active context
// ═══════════════════════════════════════════════════════════════════════════

describe("ConversationTombstoner — non-reentry", () => {
	const messages: Array<{ role: "user" | "assistant"; content: string }> = Array.from({ length: 12 }, (_, i) => ({
		role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
		content: `Turn ${i} summary sentence that stops at the first period. DEEPBODY-${String(i).padStart(2, "0")} unique detail placed deep in the body so it is never part of the tombstone summary.`,
	}));

	it("tombstoned originals are not present verbatim in active context", () => {
		const tombstoner = new ConversationTombstoner(5, 2);
		const result = tombstoner.tombstone(messages);

		expect(result.tombstoned).toBeGreaterThan(0);
		// The oldest turns were tombstoned: their deep-body markers (placed AFTER
		// the summary sentence) must NOT appear in the compressed (active) context.
		const joined = result.compressed.map(m => m.content).join("\n");
		for (let i = 0; i < 5; i++) {
			expect(joined).not.toContain(`DEEPBODY-${String(i).padStart(2, "0")}`);
		}
		// But the originals are still retrievable via lookup.
		const original = tombstoner.lookupByTurn(0);
		expect(original).toContain("DEEPBODY-00");
	});

	it("recent messages stay verbatim in active context", () => {
		const tombstoner = new ConversationTombstoner(5, 2);
		const result = tombstoner.tombstone(messages);
		const joined = result.compressed.map(m => m.content).join("\n");
		expect(joined).toContain("DEEPBODY-10");
		expect(joined).toContain("DEEPBODY-11");

	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Context pyramid — payload changes and essential preservation
// ═══════════════════════════════════════════════════════════════════════════

describe("ContextPyramid — payload resolution", () => {
	const context = {
		identity: "You are a coding agent.",
		recentMessages: ["msg1", "msg2", "msg3", "msg4"],
		memories: ["memory1", "memory2"],
		skills: ["skill1: desc", "skill2: desc"],
		fullHistory: "h1\nh2\nh3\nh4\nh5",
	};

	it("each level strictly adds content (monotonic payload growth)", () => {
		const sizes: number[] = [];
		for (let level = 0 as const; level <= 4; level++) {
			const pyramid = new ContextPyramid(level);
			const filtered = pyramid.filterContext(context);
			sizes.push(filtered.length);
		}
		// Strictly non-decreasing: deeper levels never drop earlier essentials.
		for (let i = 1; i < sizes.length; i++) {
			expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[i - 1]!);
		}
		expect(sizes[4]!).toBeGreaterThan(sizes[0]!);
	});

	it("level 0 payload is identity only and level 4 includes full history", () => {
		const level0 = new ContextPyramid(0);
		expect(level0.filterContext(context)).toBe("You are a coding agent.");

		const level4 = new ContextPyramid(4);
		const full = level4.filterContext(context);
		expect(full).toContain("h1");
		expect(full).toContain("h5");
		expect(full).toContain("skill1");
	});

	it("resolveLevel picks higher resolution for complex tasks", () => {
		const pyramid = new ContextPyramid(0);
		// Message 50-100 chars with a complex keyword but under the 100-char
		// gate for level 3 lands at level 2 (documented heuristic).
		expect(pyramid.resolveLevel("implement a detailed architecture for this service please")).toBe(2);
		// A long (>200 char) research-y message reaches the top tier.
		const deep =
			"research all options comprehensively and investigate every trade-off in depth with a deep dive analysis of the alternatives and their long term consequences for the system and also compare the costs and benefits of each approach before we decide which one to adopt for the final implementation";
		expect(pyramid.resolveLevel(deep)).toBe(4);
		expect(pyramid.resolveLevel("ok")).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Context delta — token reduction measurement
// ═══════════════════════════════════════════════════════════════════════════

describe("ContextDeltaCache — measured reduction and loss", () => {
	it("cache hit reports exact static-token savings and drops the static part", () => {
		const cache = new ContextDeltaCache();
		const full = "system prompt ".repeat(500) + "\n<conversation>\nuser message";

		cache.processTurn(full); // miss, primes the static hash
		const hit = cache.processTurn("system prompt ".repeat(500) + "\n<conversation>\nnext message");

		expect(hit.staticChanged).toBe(false);
		expect(hit.tokensSaved).toBeGreaterThan(0);
		expect(hit.content).not.toContain("system prompt");
		expect(hit.content).toContain("next message");
		// Information loss is inherent to the delta approach: the static prefix is
		// dropped from the wire payload and must be replayed by the provider's
		// prompt-caching layer. Without provider caching this delta is lossy.
		expect(cache.stats.total_input_tokens).toBeLessThan(
			// full static + dynamic (miss) + dynamic only (hit)
			500 * 4 + 4,
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Lazy skills — unused stays unloaded
// ═══════════════════════════════════════════════════════════════════════════

describe("LazySkillLoader — load only when needed", () => {
	const skills: SkillEntry[] = [
		{ name: "code-review", description: "Review code for bugs", fullContent: "FULL REVIEW GUIDE", tokens: 100 },
		{ name: "deploy", description: "Deploy to production servers", fullContent: "FULL DEPLOY GUIDE", tokens: 120 },
		{ name: "database", description: "Database migrations and schema", fullContent: "FULL DB GUIDE", tokens: 200 },
	];

	it("unused skills stay unloaded after unrelated messages", () => {
		const loader = new LazySkillLoader();
		loader.registerSkills(skills);
		loader.processMessage("just a greeting", 3);
		loader.processMessage("what time is it", 3);

		expect(loader.loadedCount).toBe(0);
		expect(loader.isLoaded("deploy")).toBe(false);
		expect(loader.isLoaded("database")).toBe(false);
		expect(loader.stats.tokensSaved).toBe(0);
	});

	it("only the referenced skill is loaded, not its siblings", () => {
		const loader = new LazySkillLoader();
		loader.registerSkills(skills);
		const result = loader.processMessage("please run the code-review skill", 3);

		expect(result.skillsToLoad.map(s => s.name)).toEqual(["code-review"]);
		expect(loader.isLoaded("code-review")).toBe(true);
		expect(loader.isLoaded("deploy")).toBe(false);
		expect(loader.isLoaded("database")).toBe(false);
		expect(loader.stats.loadedOnDemand).toBe(1);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard — real counters, not mock numbers
// ═══════════════════════════════════════════════════════════════════════════

describe("Dashboard — real counters", () => {
	it("DOCUMENTED GAP: the master `enabled:false` does not gate subsystem methods", () => {
		// `processTurn` honors the master switch, but compressToolOutput,
		// cacheResponse and tombstoneMessages only check their OWN subsystem
		// flags. With `{ enabled: false }` (and subsystem defaults left true)
		// the subsystems still act. This pins the current behavior so the gap
		// is explicit rather than silently assumed disabled.
		const tbm = new TbmManager({ enabled: false });

		const turn = tbm.processTurn("fix bug", "full context");
		expect(turn.content).toBe("full context"); // master switch honored here

		const compressed = tbm.compressToolOutput("terminal", "x".repeat(5000));
		expect(compressed.compressed).toBe(true); // subsystem flag still true

		tbm.cacheResponse("q", "a");
		expect(tbm.responseCache.stats.cacheSize).toBe(1); // still caches

		const tombstoned = tbm.tombstoneMessages(
			Array.from({ length: 30 }, (_, i) => ({
				role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
				content: `turn ${i} message with padding content to be tombstoned`,
			})),
		).tombstoned;
		expect(tombstoned).toBeGreaterThan(0); // still tombstones

		// Mitigation: callers must pass `enabled:false` AND disable each
		// subsystem, or route all calls through the master gate themselves.
	});

	it("renders a clean dashboard for a fresh (zero-activity) manager", () => {
		const tbm = new TbmManager();
		// Future sessionStart simulates clock skew; must not produce negative
		// durations or NaN/Infinity anywhere in the rendered dashboard.
		const data = buildDashboard(tbm, Date.now() + 60_000);

		expect(data.sessionDuration).toBe("0s");
		expect(data.totalInputTokens).toBe(0);
		expect(data.cachedTokens).toBe(0);
		expect(data.estimatedCost).toBe("<$0.01");
		expect(data.cacheHitRate).toBe("0%");
		expect(data.compressionRatio).toBe("0%");
		expect(data.tokensSaved).toBe("0");
		expect(data.tombstonesActive).toBe(0);
		expect(data.responseCacheSize).toBe(0);
		expect(data.skillsLoaded).toBe("0/0");

		const rendered = renderDashboard(data);
		expect(rendered).not.toContain("NaN");
		expect(rendered).not.toContain("Infinity");
		expect(rendered).not.toMatch(/-\d/);
		expect(rendered).toContain("0%");
	});

	it("clamps negative subsystem counters in the dashboard", () => {
		// buildDashboard only reads the subsystem stats getters, so a fake
		// manager with negative counters exercises the same clamp path a
		// corrupt/legacy session would hit.
		const fake = {
			contextDelta: {
				stats: { turns: -3, cache_hits: -1, tokens_saved: -500, total_input_tokens: -1000 },
			},
			pyramid: { stats: { currentLevel: 0 } },
			compressor: {
				stats: { compressed: -2, totalOutputs: -4, tokensSaved: -50 },
			},
			responseCache: { stats: { tokensSaved: -5, cacheSize: -1 } },
			tombstoner: { stats: { tokensSaved: -10, messagesTombstoned: -1 } },
			lazySkills: { stats: { loadedOnDemand: -1, totalAvailable: -2, tokensSaved: -3 } },
			commMode: { effective: "normal" },
		} as unknown as TbmManager;

		const data = buildDashboard(fake, Date.now());
		expect(data.totalInputTokens).toBe(0);
		expect(data.cachedTokens).toBe(0);
		expect(data.tombstonesActive).toBe(0);
		expect(data.tokensSaved).toBe("0");
		expect(data.estimatedCost).toBe("<$0.01");
		const rendered = renderDashboard(data);
		expect(rendered).not.toMatch(/-\d/);
	});

	it("reports subsystem counters truthfully after real activity", () => {
		const tbm = new TbmManager();
		const sessionStart = Date.now();

		// Real activity across subsystems.
		tbm.processTurn("fix bug", "system prompt\n<conversation>\nfix bug");
		tbm.processTurn("fix bug", "system prompt\n<conversation>\nfix bug again");
		tbm.compressToolOutput("terminal", "x".repeat(5000));
		tbm.cacheResponse("question", "answer");
		tbm.registerSkills([{ name: "s1", description: "d", fullContent: "c", tokens: 10 }]);

		const data = buildDashboard(tbm, sessionStart);

		// tokensSaved must equal the sum of subsystem counters (formatted the
		// same way dashboard.formatNumber does: plain string below 1000).
		const expectedSaved =
			tbm.contextDelta.stats.tokens_saved +
			tbm.compressor.stats.tokensSaved +
			tbm.tombstoner.stats.tokensSaved +
			tbm.responseCache.stats.tokensSaved +
			tbm.lazySkills.stats.tokensSaved;
		const expectedFormatted =
			expectedSaved >= 1_000_000
				? `${(expectedSaved / 1_000_000).toFixed(1)}M`
				: expectedSaved >= 1_000
					? `${(expectedSaved / 1_000).toFixed(1)}K`
					: String(expectedSaved);
		expect(data.tokensSaved).toBe(expectedFormatted);

		// cacheHitRate is derived from real context-delta turns.
		expect(data.cacheHitRate).toBe("50%"); // 1 hit / 2 turns

		// compression ratio is real: 1 compressed of 1 output.
		expect(data.compressionRatio).toBe("100%");

		// cache size is real.
		expect(data.responseCacheSize).toBe(1);

		// skills loaded from real registration.
		expect(data.skillsLoaded).toBe("0/1");
	});
});
