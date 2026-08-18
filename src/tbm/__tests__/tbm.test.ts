/**
 * TBM Unit Tests
 *
 * Tests all 7 TBM subsystems + dashboard.
 * Run: bun test src/tbm/__tests__/tbm.test.ts
 */

import { describe, expect, it } from "vitest";

import { ContextDeltaCache } from "../context-delta";
import { ContextPyramid, PYRAMID_LEVELS } from "../context-pyramid";
import { LazySkillLoader, type SkillEntry } from "../lazy-skills";
import { ToolOutputCompressor } from "../tool-compress";
import { CommunicationModeManager, COMM_MODES } from "../comm-modes";
import { ConversationTombstoner } from "../tombstone";
import { ResponseCache } from "../response-cache";
import { renderDashboard, renderCompactDashboard, type DashboardData } from "../dashboard";
import { TbmManager } from "../index";
import { resolveTbmConfig, DEFAULT_TBM_CONFIG } from "../config";

// ═══════════════════════════════════════════════════════════════════════════
// Context Delta Cache
// ═══════════════════════════════════════════════════════════════════════════

describe("ContextDeltaCache", () => {
	const context = (message: string) => `system prompt\n<conversation>\n${message}`;

	it("should miss on first call", () => {
		const cache = new ContextDeltaCache();
		const result = cache.processTurn(context("user message"));

		expect(result.staticChanged).toBe(true);
		expect(result.content).toContain("user message");
		expect(result.tokensSaved).toBe(0);
		expect(cache.stats).toMatchObject({ turns: 1, cache_hits: 0, tokens_saved: 0 });
	});

	it("should hit on second call with the same static prefix", () => {
		const cache = new ContextDeltaCache();
		cache.processTurn(context("message one"));
		const result = cache.processTurn(context("message two"));

		expect(result.staticChanged).toBe(false);
		expect(result.content).toContain("message two");
		expect(result.content).not.toContain("system prompt");
		expect(result.tokensSaved).toBeGreaterThan(0);
		expect(cache.stats.cache_hits).toBe(1);
	});

	it("should miss when the static prefix changes", () => {
		const cache = new ContextDeltaCache();
		cache.processTurn(context("message one"));
		const result = cache.processTurn(`changed system prompt\n<conversation>\nmessage two`);

		expect(result.staticChanged).toBe(true);
		expect(cache.stats).toMatchObject({ turns: 2, cache_hits: 0 });
	});

	it("should track hit rate and reset properly", () => {
		const cache = new ContextDeltaCache();
		cache.processTurn(context("message one"));
		cache.processTurn(context("message two"));
		expect(cache.hitRate).toBeCloseTo(1 / 2);
		expect(cache.stats.tokens_saved).toBeGreaterThan(0);

		cache.reset();
		expect(cache.stats).toEqual({ turns: 0, cache_hits: 0, tokens_saved: 0, total_input_tokens: 0 });
		expect(cache.hitRate).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Context Pyramid
// ═══════════════════════════════════════════════════════════════════════════

describe("ContextPyramid", () => {
	const context = {
		identity: "You are a helpful assistant.",
		recentMessages: ["msg1", "msg2", "msg3", "msg4"],
		fullHistory: "h1\nh2\nh3\nh4\nh5",
		memories: ["memory1", "memory2"],
		skills: ["skill1: desc", "skill2: desc"],
	};

	it("should start at the configured level", () => {
		const pyramid = new ContextPyramid(0);
		expect(pyramid.level).toBe(0);
		expect(pyramid.current.label).toBe("Identity");
	});

	it("should filter context according to the current level", () => {
		const level0 = new ContextPyramid(0);
		expect(level0.filterContext(context)).toBe(context.identity);

		const level2 = new ContextPyramid(2);
		const filtered = level2.filterContext(context);
		expect(filtered).toContain("msg2");
		expect(filtered).toContain("memory1");
		expect(filtered).not.toContain("skill1");

		const level4 = new ContextPyramid(4);
		expect(level4.filterContext(context)).toContain("h1");
	});

	it("should resolve and set levels", () => {
		const pyramid = new ContextPyramid(0);
		expect(pyramid.resolveLevel("implement a detailed architecture for this service")).toBe(1);
		pyramid.setLevel(2);
		expect(pyramid.level).toBe(2);
		expect(pyramid.stats.escalations).toBe(1);
	});

	it("should escalate on low quality and expose five levels", () => {
		const pyramid = new ContextPyramid(0);
		pyramid.reportQuality(0.1);
		expect(pyramid.level).toBe(1);
		expect(PYRAMID_LEVELS.size).toBe(5);
		expect(PYRAMID_LEVELS.get(4)?.label).toBe("Deep Research");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Lazy Skill Loader
// ═══════════════════════════════════════════════════════════════════════════

describe("LazySkillLoader", () => {
	const skills: SkillEntry[] = [
		{
			name: "code-review",
			description: "Review code for bugs",
			fullContent: "Full code review guide",
			tokens: 100,
		},
		{
			name: "deploy",
			description: "Deploy to production",
			fullContent: "Full deployment guide",
			tokens: 120,
		},
	];

	it("should return a name-only skill index", () => {
		const loader = new LazySkillLoader();
		loader.registerSkills(skills);
		const index = loader.getNameIndex();

		expect(index).toContain("code-review");
		expect(index).toContain("deploy");
		expect(loader.loadedCount).toBe(0);
		expect(loader.stats).toMatchObject({ totalAvailable: 2, namesInjected: 2 });
	});

	it("should load referenced skills on demand", () => {
		const loader = new LazySkillLoader();
		loader.registerSkills(skills);
		const result = loader.processMessage("Please use the code-review skill", 3);

		expect(result.skillsToLoad.map((skill) => skill.name)).toEqual(["code-review"]);
		expect(result.indexSection).toContain("Available Skills");
		expect(loader.loadedCount).toBe(1);
		expect(loader.isLoaded("code-review")).toBe(true);
		expect(loader.stats.loadedOnDemand).toBe(1);
	});

	it("should not reload a skill or load unknown skills", () => {
		const loader = new LazySkillLoader();
		loader.registerSkills(skills);
		loader.processMessage("use deploy", 3);
		const second = loader.processMessage("use deploy and nonexistent", 3);

		expect(second.skillsToLoad).toHaveLength(0);
		expect(loader.loadedCount).toBe(1);
	});

	it("should reset loaded state", () => {
		const loader = new LazySkillLoader();
		loader.registerSkills(skills);
		loader.processMessage("use code-review", 3);
		loader.reset();

		expect(loader.loadedCount).toBe(0);
		expect(loader.isLoaded("code-review")).toBe(false);
		expect(loader.stats.loadedOnDemand).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Tool Output Compressor
// ═══════════════════════════════════════════════════════════════════════════

describe("ToolOutputCompressor", () => {
	const compressor = () => new ToolOutputCompressor(DEFAULT_TBM_CONFIG.compress.budgets);

	it("should not compress output within budget", () => {
		const result = compressor().compress("terminal", "short output");

		expect(result.compressed).toBe(false);
		expect(result.output).toBe("short output");
		expect(result.tokensSaved).toBe(0);
	});

	it("should compress output exceeding a tool budget", () => {
		const result = compressor().compress("terminal", "x".repeat(3000));

		expect(result.compressed).toBe(true);
		expect(result.tokensSaved).toBeGreaterThan(0);
		expect(result.output).toContain("tokens compressed");
	});

	it("should strip ANSI and track per-tool stats", () => {
		const toolCompressor = compressor();
		const result = toolCompressor.compress("terminal", "\x1b[31mError\x1b[0m: " + "x".repeat(3000));

		expect(result.output).not.toContain("\x1b[31m");
		expect(toolCompressor.stats).toMatchObject({ totalOutputs: 1, compressed: 1 });
		expect(toolCompressor.stats.perTool.terminal?.compressed).toBe(1);
	});

	it("should use the configured default budget for unknown tools", () => {
		const toolCompressor = compressor();
		const result = toolCompressor.compress("unknown_tool", "x".repeat(3000));

		expect(result.compressed).toBe(true);
		toolCompressor.reset();
		expect(toolCompressor.stats).toMatchObject({ totalOutputs: 0, compressed: 0, tokensSaved: 0 });
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Communication Modes
// ═══════════════════════════════════════════════════════════════════════════

describe("CommunicationModeManager", () => {
	it("should default to auto mode", () => {
		const manager = new CommunicationModeManager();

		expect(manager.setting).toBe("auto");
		expect(manager.effective).toBe("normal");
	});

	it("should switch modes explicitly", () => {
		const manager = new CommunicationModeManager();
		manager.setMode("caveman");

		expect(manager.setting).toBe("caveman");
		expect(manager.effective).toBe("caveman");
		expect(manager.targetTokens).toBe(COMM_MODES.get("caveman")?.targetTokens);
		expect(manager.directive).toContain("caveman style");
	});

	it("should resolve automatic modes from messages", () => {
		const manager = new CommunicationModeManager("auto");
		expect(manager.resolveForMessage("fix bug").mode).toBe("caveman");
		expect(manager.resolveForMessage("Please explain in detail why this design works").mode).toBe("verbose");
		expect(manager.usage.get("caveman")).toBe(1);
		expect(manager.usage.get("verbose")).toBe(1);
	});

	it("should reset usage while preserving the selected setting", () => {
		const manager = new CommunicationModeManager("verbose");
		manager.resolveForMessage("explain this");
		manager.reset();

		expect(manager.setting).toBe("verbose");
		expect(manager.effective).toBe("verbose");
		expect(manager.usage.get("verbose")).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Conversation Tombstoner
// ═══════════════════════════════════════════════════════════════════════════

describe("ConversationTombstoner", () => {
	const messages: Array<{ role: "user" | "assistant"; content: string }> = [
		{ role: "user", content: "First message with enough content to summarize." },
		{ role: "assistant", content: "Response to the first message with useful details." },
		{ role: "user", content: "Second question about deployment configuration." },
		{ role: "assistant", content: "Answer to the second question with configuration details." },
		{ role: "user", content: "Recent question one." },
		{ role: "assistant", content: "Recent answer two." },
	];

	it("should tombstone old messages and keep recent messages", () => {
		const tombstoner = new ConversationTombstoner(3, 2);
		const result = tombstoner.tombstone(messages);

		expect(result.tombstoned).toBe(4);
		expect(result.compressed).toHaveLength(6);
		expect(result.compressed[0]?.content).toContain("Turn 1");
		expect(result.compressed[4]?.content).toBe("Recent question one.");
		expect(result.tokensSaved).toBe(tombstoner.stats.tokensSaved);
		expect(tombstoner.stats.messagesTombstoned).toBe(4);
	});

	it("should retrieve original content and track stats", () => {
		const tombstoner = new ConversationTombstoner(1, 1);
		tombstoner.tombstone(messages);

		expect(tombstoner.lookupByTurn(0)).toBe(messages[0]?.content);
		expect(tombstoner.stats.messagesTombstoned).toBe(5);
		expect(tombstoner.stats.tokensSaved).toBe(
			Math.max(0, tombstoner.stats.originalTokens - tombstoner.stats.tombstoneTokens),
		);
		expect(tombstoner.stats.compressionRatio).toBeGreaterThan(0);
		expect(tombstoner.stats.compressionRatio).toBeLessThanOrEqual(1);
	});

	it("should return short conversations unchanged and reset state", () => {
		const tombstoner = new ConversationTombstoner(20, 5);
		expect(tombstoner.tombstone(messages.slice(0, 3)).tombstoned).toBe(0);

		tombstoner.tombstone(messages);
		tombstoner.reset();
		expect(tombstoner.entries).toHaveLength(0);
		expect(tombstoner.stats.messagesTombstoned).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Response Cache
// ═══════════════════════════════════════════════════════════════════════════

describe("ResponseCache", () => {
	it("should miss on an empty cache", () => {
		const cache = new ResponseCache();
		const result = cache.get("test query");

		expect(result).toEqual({ hit: false });
		expect(cache.stats).toMatchObject({ totalQueries: 1, misses: 1, hitRate: 0 });
	});

	it("should hit on exact and case-insensitive matches", () => {
		const cache = new ResponseCache();
		cache.set("Hello World", "hi");

		expect(cache.get("hello world")).toEqual({ hit: true, response: "hi", matchType: "exact" });
		expect(cache.stats.exactHits).toBe(1);
		expect(cache.stats.tokensSaved).toBe(1);
	});

	it("should track misses and hit rate", () => {
		const cache = new ResponseCache();
		cache.set("q1", "a1");
		cache.get("q1");
		cache.get("completely different query");

		expect(cache.stats.hitRate).toBeCloseTo(0.5);
	});

	it("should expire entries and reset properly", () => {
		const cache = new ResponseCache(0);
		cache.set("q", "a");
		expect(cache.get("q")).toEqual({ hit: false });

		cache.set("other", "answer");
		cache.reset();
		expect(cache.stats).toMatchObject({ totalQueries: 0, cacheSize: 0, misses: 0 });
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Token Dashboard
// ═══════════════════════════════════════════════════════════════════════════

describe("Token Dashboard", () => {
	const mockData: DashboardData = {
		sessionDuration: "1m",
		totalInputTokens: 50000,
		totalOutputTokens: 10000,
		cachedTokens: 30000,
		estimatedCost: "$0.300",
		cacheHitRate: "80%",
		pyramidLevel: 2,
		pyramidLabel: "Contextual",
		commMode: "normal",
		compressionRatio: "40%",
		tokensSaved: "30K",
		tombstonesActive: 5,
		responseCacheSize: 15,
		skillsLoaded: "3/10",
	};

	it("should render the full dashboard", () => {
		const report = renderDashboard(mockData);

		expect(report).toContain("Token Budget Manager");
		expect(report).toContain("50000");
		expect(report).toContain("80%");
		expect(report).toContain("normal");
		expect(report).toContain("40%");
		expect(report).toContain("3/10");
	});

	it("should render the compact dashboard", () => {
		const compact = renderCompactDashboard(mockData);

		expect(compact).toContain("TBM");
		expect(compact).toContain("L2");
		expect(compact).toContain("normal");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// TBM Config
// ═══════════════════════════════════════════════════════════════════════════

describe("TBM Config", () => {
	it("should use defaults with no overrides", () => {
		const config = resolveTbmConfig();

		expect(config.enabled).toBe(true);
		expect(config.context_delta.enabled).toBe(true);
		expect(config.pyramid.enabled).toBe(true);
		expect(config.tombstone.after_turns).toBe(20);
		expect(config.response_cache.similarity_threshold).toBe(0.95);
	});

	it("should merge overrides while preserving other defaults", () => {
		const config = resolveTbmConfig({
			enabled: false,
			comm_mode: "caveman",
			tombstone: { ...DEFAULT_TBM_CONFIG.tombstone, after_turns: 5 },
		});

		expect(config.enabled).toBe(false);
		expect(config.comm_mode).toBe("caveman");
		expect(config.tombstone.after_turns).toBe(5);
		expect(config.tombstone.keep_recent).toBe(DEFAULT_TBM_CONFIG.tombstone.keep_recent);
		expect(config.pyramid.enabled).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// TBM Manager (Integration)
// ═══════════════════════════════════════════════════════════════════════════

describe("TbmManager", () => {
	it("should initialize with all subsystems", () => {
		const tbm = new TbmManager();

		expect(tbm.enabled).toBe(true);
		expect(tbm.contextDelta).toBeDefined();
		expect(tbm.pyramid).toBeDefined();
		expect(tbm.lazySkills).toBeDefined();
		expect(tbm.compressor).toBeDefined();
		expect(tbm.commMode).toBeDefined();
		expect(tbm.tombstoner).toBeDefined();
		expect(tbm.responseCache).toBeDefined();
	});

	it("should process turns and compress tool output", () => {
		const tbm = new TbmManager();
		const turn = tbm.processTurn("fix bug", "system prompt\n<conversation>\nfix bug");
		const compressed = tbm.compressToolOutput("terminal", "short output");

		expect(turn.content).toContain("fix bug");
		expect(turn.directive).toContain("caveman");
		expect(compressed).toEqual({ output: "short output", compressed: false, tokensSaved: 0 });
	});

	it("should cache responses and register skills", () => {
		const tbm = new TbmManager();
		tbm.cacheResponse("test", "answer");
		tbm.registerSkills([
			{ name: "test-skill", description: "A test skill", fullContent: "Skill content", tokens: 20 },
		]);

		expect(tbm.responseCache.get("test")).toMatchObject({ hit: true, response: "answer" });
		expect(tbm.lazySkills.getNameIndex()).toContain("test-skill");
	});

	it("should tombstone messages and render dashboards", () => {
		const tbm = new TbmManager({ tombstone: { ...DEFAULT_TBM_CONFIG.tombstone, after_turns: 1, keep_recent: 1 } });
		const messages: Array<{ role: "user" | "assistant"; content: string }> = [
			{ role: "user", content: "old message with details" },
			{ role: "assistant", content: "old response with details" },
			{ role: "user", content: "recent message" },
		];

		expect(tbm.tombstoneMessages(messages).tombstoned).toBe(2);
		expect(tbm.renderDashboard()).toContain("Token Budget Manager");
		expect(tbm.renderCompactDashboard()).toContain("TBM");
	});

	it("should reset all subsystems", () => {
		const tbm = new TbmManager();
		tbm.processTurn("fix bug", "system prompt\n<conversation>\nfix bug");
		tbm.cacheResponse("q", "answer");
		tbm.reset();

		expect(tbm.contextDelta.stats.turns).toBe(0);
		expect(tbm.responseCache.stats.cacheSize).toBe(0);
	});

	it("should respect disabled configuration", () => {
		const tbm = new TbmManager({ enabled: false });
		const result = tbm.processTurn("fix bug", "full context");

		expect(result.content).toBe("full context");
		expect(result.directive).toBe("");
		expect(result.tokensSavedThisTurn).toBe(0);
	});
});
