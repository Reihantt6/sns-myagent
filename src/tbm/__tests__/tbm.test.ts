/**
 * TBM Unit Tests
 *
 * Tests all 7 TBM subsystems + dashboard.
 * Run: npx vitest src/tbm/__tests__/tbm.test.ts
 * (or: bun test src/tbm/__tests__/tbm.test.ts)
 */

import { describe, it, expect, beforeEach } from "vitest";

// We import from compiled output or use relative paths
// For test discovery, these test the pure logic functions

import { ContextDeltaCache } from "../context-delta";
import { ContextPyramid, PYRAMID_LEVELS } from "../context-pyramid";
import { LazySkillManager } from "../lazy-skills";
import { ToolCompressor, DEFAULT_TOOL_BUDGETS } from "../tool-compress";
import { CommModeManager, COMM_MODES } from "../comm-modes";
import { TombstoneManager } from "../tombstone";
import { ResponseCache } from "../response-cache";
import { renderTokenDashboard, formatCompactDashboard } from "../dashboard";
import { TbmManager } from "../index";
import { resolveTbmConfig, DEFAULT_TBM_CONFIG } from "../config";

// ═══════════════════════════════════════════════════════════════════════════
// Context Delta Cache
// ═══════════════════════════════════════════════════════════════════════════

describe("ContextDeltaCache", () => {
	it("should miss on first call", () => {
		const cdc = new ContextDeltaCache();
		const result = cdc.computeDelta("system prompt", "user message");
		expect(result.isCacheHit).toBe(false);
		expect(result.sendCachePrefix).toBe(false);
		expect(cdc.stats.cacheMisses).toBe(1);
		expect(cdc.stats.cacheHits).toBe(0);
	});

	it("should hit on second call with same prefix", () => {
		const cdc = new ContextDeltaCache();
		cdc.computeDelta("system prompt", "msg1");
		const result = cdc.computeDelta("system prompt", "msg2");
		expect(result.isCacheHit).toBe(true);
		expect(result.sendCachePrefix).toBe(true);
		expect(cdc.stats.cacheHits).toBe(1);
		expect(cdc.stats.tokensSaved).toBeGreaterThan(0);
	});

	it("should miss when prefix changes", () => {
		const cdc = new ContextDeltaCache();
		cdc.computeDelta("system prompt v1", "msg1");
		const result = cdc.computeDelta("system prompt v2", "msg2");
		expect(result.isCacheHit).toBe(false);
		expect(cdc.stats.cacheMisses).toBe(2);
	});

	it("should track hit rate", () => {
		const cdc = new ContextDeltaCache();
		cdc.computeDelta("prefix", "msg1");
		cdc.computeDelta("prefix", "msg2");
		cdc.computeDelta("prefix", "msg3");
		expect(cdc.hitRate).toBeCloseTo(2 / 3);
		expect(cdc.savingsPercent).toBeGreaterThan(0);
	});

	it("should reset properly", () => {
		const cdc = new ContextDeltaCache();
		cdc.computeDelta("prefix", "msg1");
		cdc.reset();
		expect(cdc.stats.totalCalls).toBe(0);
		expect(cdc.hasCachedPrefix).toBe(false);
	});

	it("should invalidate cache", () => {
		const cdc = new ContextDeltaCache();
		cdc.computeDelta("prefix", "msg1");
		cdc.invalidate();
		const result = cdc.computeDelta("prefix", "msg2");
		expect(result.isCacheHit).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Context Pyramid
// ═══════════════════════════════════════════════════════════════════════════

describe("ContextPyramid", () => {
	const testCtx = {
		identity: "You are a helpful assistant.",
		recentMessages: ["msg1", "msg2", "msg3", "msg4"],
		fullHistory: ["h1", "h2", "h3", "h4", "h5"],
		memories: ["memory1", "memory2"],
		skills: ["skill1: desc", "skill2: desc"],
	};

	it("should start at configured level", () => {
		const pyramid = new ContextPyramid(0);
		expect(pyramid.currentLevel).toBe(0);
	});

	it("should include only identity at level 0", () => {
		const pyramid = new ContextPyramid(0);
		const result = pyramid.assembleContext(testCtx);
		expect(result.level).toBe(0);
		expect(result.includedComponents).toContain("identity");
		expect(result.includedComponents).not.toContain("recent_messages");
	});

	it("should include recent messages at level 1", () => {
		const pyramid = new ContextPyramid(1);
		const result = pyramid.assembleContext(testCtx);
		expect(result.includedComponents).toContain("recent_messages");
		expect(result.context).toContain("msg2"); // last 3
	});

	it("should include memories at level 2", () => {
		const pyramid = new ContextPyramid(2);
		const result = pyramid.assembleContext(testCtx);
		expect(result.includedComponents).toContain("memories");
		expect(result.context).toContain("memory1");
	});

	it("should include skills at level 3", () => {
		const pyramid = new ContextPyramid(3);
		const result = pyramid.assembleContext(testCtx);
		expect(result.includedComponents).toContain("skills");
	});

	it("should include full history at level 4", () => {
		const pyramid = new ContextPyramid(4);
		const result = pyramid.assembleContext(testCtx);
		expect(result.includedComponents).toContain("full_history");
		expect(result.context).toContain("h1");
	});

	it("should escalate on repeated low quality", () => {
		const pyramid = new ContextPyramid(0);
		pyramid.evaluateQuality({ refusal: true, requestedContext: false, tooShort: false, forceEscalate: false });
		expect(pyramid.currentLevel).toBe(0); // needs 2 consecutive
		pyramid.evaluateQuality({ refusal: true, requestedContext: false, tooShort: false, forceEscalate: false });
		expect(pyramid.currentLevel).toBe(1);
	});

	it("should force escalate immediately", () => {
		const pyramid = new ContextPyramid(0);
		pyramid.evaluateQuality({ refusal: false, requestedContext: false, tooShort: false, forceEscalate: true });
		expect(pyramid.currentLevel).toBe(1);
	});

	it("should de-escalate after sustained high quality", () => {
		const pyramid = new ContextPyramid(2);
		for (let i = 0; i < 5; i++) {
			pyramid.evaluateQuality({ refusal: false, requestedContext: false, tooShort: false, forceEscalate: false });
		}
		expect(pyramid.currentLevel).toBe(1);
	});

	it("should have 5 pyramid levels defined", () => {
		expect(PYRAMID_LEVELS).toHaveLength(5);
		expect(PYRAMID_LEVELS[0]!.level).toBe(0);
		expect(PYRAMID_LEVELS[4]!.level).toBe(4);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Lazy Skill Manager
// ═══════════════════════════════════════════════════════════════════════════

describe("LazySkillManager", () => {
	const skills = [
		{ name: "code-review", description: "Review code for bugs" },
		{ name: "deploy", description: "Deploy to production" },
	];

	it("should return skill index with names only", () => {
		const lsm = new LazySkillManager(skills);
		const index = lsm.getSkillIndex();
		expect(index).toContain("code-review");
		expect(index).toContain("deploy");
		expect(lsm.loadedCount).toBe(0);
	});

	it("should load skill on demand", async () => {
		const lsm = new LazySkillManager(skills);
		const info = await lsm.loadSkill("code-review", async () => "Full code review guide...");
		expect(info).not.toBeNull();
		expect(info!.isLoaded).toBe(true);
		expect(lsm.loadedCount).toBe(1);
	});

	it("should return null for unknown skills", async () => {
		const lsm = new LazySkillManager(skills);
		const info = await lsm.loadSkill("nonexistent");
		expect(info).toBeNull();
	});

	it("should track stats correctly", async () => {
		const lsm = new LazySkillManager(skills);
		await lsm.loadSkill("deploy", async () => "Deploy instructions...");
		const stats = lsm.stats;
		expect(stats.totalSkills).toBe(2);
		expect(stats.loadedSkills).toBe(1);
		expect(stats.demandLoads).toBe(1);
	});

	it("should unload skills", async () => {
		const lsm = new LazySkillManager(skills);
		await lsm.loadSkill("code-review", async () => "content");
		lsm.unloadSkill("code-review");
		expect(lsm.loadedCount).toBe(0);
		expect(lsm.getSkillContent("code-review")).toBeNull();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Tool Compressor
// ═══════════════════════════════════════════════════════════════════════════

describe("ToolCompressor", () => {
	it("should not compress output within budget", () => {
		const tc = new ToolCompressor();
		const result = tc.compress("terminal", "short output");
		expect(result.wasCompressed).toBe(false);
		expect(result.output).toBe("short output");
	});

	it("should compress terminal output exceeding budget", () => {
		const tc = new ToolCompressor();
		const longOutput = "x".repeat(3000); // ~750 tokens > 500 budget
		const result = tc.compress("terminal", longOutput);
		expect(result.wasCompressed).toBe(true);
		expect(result.outputTokens).toBeLessThan(result.inputTokens);
	});

	it("should strip ANSI from terminal output", () => {
		const tc = new ToolCompressor();
		const ansiOutput = "\x1b[31mError\x1b[0m: " + "x".repeat(3000);
		const result = tc.compress("terminal", ansiOutput);
		expect(result.output).not.toContain("\x1b[31m");
	});

	it("should compress read_file with line truncation", () => {
		const tc = new ToolCompressor();
		const lines = Array.from({ length: 200 }, (_, i) => `line ${i}: ${"x".repeat(40)}`).join("\n");
		const result = tc.compress("read_file", lines);
		expect(result.wasCompressed).toBe(true);
		expect(result.output).toContain("lines omitted");
	});

	it("should compress search_files keeping top results", () => {
		const tc = new ToolCompressor();
		const results = Array.from({ length: 100 }, (_, i) => `result ${i}: ${"match".repeat(20)}`).join("\n");
		const result = tc.compress("search_files", results);
		expect(result.wasCompressed).toBe(true);
		expect(result.output).toContain("truncated");
	});

	it("should track compression stats", () => {
		const tc = new ToolCompressor();
		tc.compress("terminal", "short");
		tc.compress("terminal", "x".repeat(3000));
		const stats = tc.stats;
		expect(stats.totalCalls).toBe(2);
		expect(stats.compressedCalls).toBe(1);
	});

	it("should handle unknown tools with default budget", () => {
		const tc = new ToolCompressor();
		const result = tc.compress("unknown_tool", "x".repeat(4000));
		expect(result.wasCompressed).toBe(true);
	});

	it("should have all defined tool budgets", () => {
		expect(DEFAULT_TOOL_BUDGETS.length).toBeGreaterThanOrEqual(4);
		const terminal = DEFAULT_TOOL_BUDGETS.find(b => b.tool === "terminal");
		expect(terminal?.maxTokens).toBe(500);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Communication Modes
// ═══════════════════════════════════════════════════════════════════════════

describe("CommModeManager", () => {
	it("should default to auto mode", () => {
		const cmm = new CommModeManager();
		expect(cmm.currentMode).toBe("auto");
		expect(cmm.effectiveMode).toBe("normal"); // default auto → normal
	});

	it("should switch modes explicitly", () => {
		const cmm = new CommModeManager();
		cmm.setMode("caveman");
		expect(cmm.effectiveMode).toBe("caveman");
		expect(cmm.targetTokens).toBe(20);
	});

	it("should provide directives", () => {
		const cmm = new CommModeManager("verbose");
		expect(cmm.directive).toContain("full explanation");
	});

	it("should auto-detect caveman for simple ops", () => {
		const cmm = new CommModeManager("auto");
		const mode = cmm.detectMode({
			queryTokens: 5,
			hasCode: true,
			isQuestion: false,
			hasReferences: false,
			recentToolCalls: 10,
			requestsExplanation: false,
		});
		expect(mode).toBe("caveman");
	});

	it("should auto-detect verbose for explanation requests", () => {
		const cmm = new CommModeManager("auto");
		const mode = cmm.detectMode({
			queryTokens: 150,
			hasCode: false,
			isQuestion: true,
			hasReferences: true,
			recentToolCalls: 0,
			requestsExplanation: true,
		});
		expect(mode).toBe("verbose");
	});

	it("should have all 3 mode definitions", () => {
		expect(COMM_MODES.caveman).toBeDefined();
		expect(COMM_MODES.normal).toBeDefined();
		expect(COMM_MODES.verbose).toBeDefined();
	});

	it("should describe current mode", () => {
		const cmm = new CommModeManager("caveman");
		expect(cmm.describe()).toContain("caveman");
		expect(cmm.describe()).toContain("20");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Tombstone Manager
// ═══════════════════════════════════════════════════════════════════════════

describe("TombstoneManager", () => {
	it("should tombstone old messages", () => {
		const tm = new TombstoneManager({ afterTurns: 3 });
		const messages = [
			{ turnNumber: 1, role: "user", content: "First message with lots of content here" },
			{ turnNumber: 2, role: "assistant", content: "Response to first message with details" },
			{ turnNumber: 3, role: "user", content: "Second question about something" },
			{ turnNumber: 4, role: "assistant", content: "Answer to second question" },
			{ turnNumber: 5, role: "user", content: "Third question" },
			{ turnNumber: 6, role: "assistant", content: "Answer to third" },
		];
		const result = tm.processHistory(messages, 6);
		// Turns 1-3 should be tombstoned (6 - 3 = 3 cutoff)
		expect(result.tombstonedCount).toBe(3);
		expect(result.reductionPercent).toBeGreaterThan(0);
	});

	it("should keep recent messages intact", () => {
		const tm = new TombstoneManager({ afterTurns: 5 });
		const messages = [
			{ turnNumber: 1, role: "user", content: "old message" },
			{ turnNumber: 8, role: "user", content: "recent message" },
		];
		const result = tm.processHistory(messages, 10);
		expect(result.activeMessages).toHaveLength(2);
		// Turn 8 should not be tombstoned
		const recent = result.activeMessages.find(m => m.turnNumber === 8);
		expect(recent?.content).toBe("recent message");
	});

	it("should retrieve original content", () => {
		const tm = new TombstoneManager({ afterTurns: 2 });
		const messages = [
			{ turnNumber: 1, role: "user", content: "original full content" },
			{ turnNumber: 3, role: "user", content: "recent" },
		];
		tm.processHistory(messages, 3);
		const original = tm.getOriginal(1);
		expect(original).toBe("original full content");
	});

	it("should track stats", () => {
		const tm = new TombstoneManager({ afterTurns: 2 });
		const messages = Array.from({ length: 10 }, (_, i) => ({
			turnNumber: i + 1,
			role: i % 2 === 0 ? "user" : "assistant",
			content: `Message ${i + 1} with some content here`,
		}));
		tm.processHistory(messages, 10);
		expect(tm.stats.totalTombstoned).toBe(8); // turns 1-8 (cutoff = 10-2 = 8)
		expect(tm.stats.archiveSize).toBe(8);
	});

	it("should handle afterTurns change", () => {
		const tm = new TombstoneManager({ afterTurns: 10 });
		tm.afterTurns = 5;
		expect(tm.afterTurns).toBe(5);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Response Cache
// ═══════════════════════════════════════════════════════════════════════════

describe("ResponseCache", () => {
	it("should miss on empty cache", () => {
		const cache = new ResponseCache();
		expect(cache.lookup("test query")).toBeNull();
		expect(cache.stats.misses).toBe(1);
	});

	it("should hit on exact match", () => {
		const cache = new ResponseCache();
		cache.store("what is 2+2?", "4", 1);
		expect(cache.lookup("what is 2+2?")).toBe("4");
		expect(cache.stats.exactHits).toBe(1);
	});

	it("should hit on case-insensitive match", () => {
		const cache = new ResponseCache();
		cache.store("Hello World", "hi", 1);
		expect(cache.lookup("hello world")).toBe("hi");
	});

	it("should track hit rate", () => {
		const cache = new ResponseCache();
		cache.store("q1", "a1", 1);
		cache.lookup("q1"); // hit
		cache.lookup("q2"); // miss
		expect(cache.stats.hitRate).toBeCloseTo(0.5);
	});

	it("should expire entries based on TTL", async () => {
		const cache = new ResponseCache({ ttlSeconds: 0 });
		cache.store("q", "a", 1);
		// TTL=0 means already expired
		const result = cache.lookup("q");
		expect(result).toBeNull();
	});

	it("should reset properly", () => {
		const cache = new ResponseCache();
		cache.store("q", "a", 1);
		cache.reset();
		expect(cache.stats.entryCount).toBe(0);
		expect(cache.lookup("q")).toBeNull();
	});

	it("should count tokens saved", () => {
		const cache = new ResponseCache();
		cache.store("q", "answer", 50);
		cache.lookup("q");
		expect(cache.stats.tokensSaved).toBe(50);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Token Dashboard
// ═══════════════════════════════════════════════════════════════════════════

describe("Token Dashboard", () => {
	const mockData: Parameters<typeof renderTokenDashboard>[0] = {
		sessionStart: Date.now() - 60000,
		now: Date.now(),
		contextDelta: {
			totalCalls: 10,
			cacheHits: 8,
			cacheMisses: 2,
			totalInputTokens: 50000,
			billedInputTokens: 20000,
			tokensSaved: 30000,
			lastAccessAt: Date.now(),
		},
		pyramidLevel: 2,
		pyramidEscalations: 1,
		commMode: "auto",
		effectiveCommMode: "normal",
		compression: {
			totalCalls: 5,
			compressedCalls: 2,
			tokensBeforeCompression: 10000,
			tokensAfterCompression: 7000,
			byTool: {},
		},
		responseCache: {
			totalLookups: 20,
			exactHits: 15,
			semanticHits: 2,
			misses: 3,
			tokensSaved: 5000,
			entryCount: 15,
			hitRate: 0.85,
		},
		tombstone: {
			totalTombstoned: 5,
			tokensBefore: 2000,
			tokensAfter: 300,
			reductionPercent: 85,
			archiveSize: 5,
		},
		skills: {
			totalSkills: 10,
			loadedSkills: 3,
			demandLoads: 3,
			totalLoadedTokens: 1500,
			tokensSaved: 30000,
		},
		totalInputTokens: 50000,
		totalOutputTokens: 10000,
		totalCachedTokens: 30000,
		inputCostPer1k: 0.003,
		outputCostPer1k: 0.015,
	};

	it("should render full dashboard", () => {
		const report = renderTokenDashboard(mockData);
		expect(report).toContain("Token Budget Manager Dashboard");
		expect(report).toContain("Pyramid level:");
		expect(report).toContain("Comm mode:");
		expect(report).toContain("Response Cache:");
		expect(report).toContain("Compression:");
		expect(report).toContain("Tombstoning:");
		expect(report).toContain("Skills:");
	});

	it("should render compact dashboard", () => {
		const compact = formatCompactDashboard(mockData);
		expect(compact).toContain("TBM:");
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
		expect(config.tombstone.after_turns).toBe(10);
	});

	it("should merge overrides", () => {
		const config = resolveTbmConfig({
			enabled: false,
			comm_mode: "caveman",
			tombstone: { after_turns: 5 },
		});
		expect(config.enabled).toBe(false);
		expect(config.comm_mode).toBe("caveman");
		expect(config.tombstone.after_turns).toBe(5);
		// Other defaults preserved
		expect(config.pyramid.enabled).toBe(true);
	});

	it("should have sensible defaults", () => {
		expect(DEFAULT_TBM_CONFIG.tombstone.after_turns).toBe(10);
		expect(DEFAULT_TBM_CONFIG.response_cache.ttl_seconds).toBe(3600);
		expect(DEFAULT_TBM_CONFIG.response_cache.semantic_threshold).toBe(0.95);
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
		expect(tbm.compressor).toBeDefined();
		expect(tbm.commMode).toBeDefined();
		expect(tbm.tombstone).toBeDefined();
		expect(tbm.responseCache).toBeDefined();
	});

	it("should record token usage", () => {
		const tbm = new TbmManager();
		tbm.recordUsage(1000, 500, 200);
		const data = tbm.dashboardData();
		expect(data.totalInputTokens).toBe(1000);
		expect(data.totalOutputTokens).toBe(500);
		expect(data.totalCachedTokens).toBe(200);
	});

	it("should process tool output through compressor", () => {
		const tbm = new TbmManager();
		const result = tbm.processToolOutput("terminal", "short output");
		expect(result).toBe("short output");
	});

	it("should check response cache", () => {
		const tbm = new TbmManager();
		expect(tbm.checkCache("test")).toBeNull();
		tbm.storeInCache("test", "answer", 10);
		expect(tbm.checkCache("test")).toBe("answer");
	});

	it("should provide comm directive", () => {
		const tbm = new TbmManager({ comm_mode: "caveman" });
		expect(tbm.getCommDirective()).toContain("caveman");
	});

	it("should provide skill index", () => {
		const tbm = new TbmManager(undefined, [
			{ name: "test-skill", description: "A test skill" },
		]);
		expect(tbm.getSkillIndex()).toContain("test-skill");
	});

	it("should tombstone old messages", () => {
		const tbm = new TbmManager({ tombstone: { after_turns: 3 } });
		const messages = Array.from({ length: 10 }, (_, i) => ({
			turnNumber: i + 1,
			role: "user",
			content: `Message ${i + 1}`,
		}));
		const result = tbm.tombstoneHistory(messages, 10);
		expect(result.tombstonedCount).toBeGreaterThan(0);
	});

	it("should render full dashboard", () => {
		const tbm = new TbmManager();
		tbm.recordUsage(1000, 500);
		const report = tbm.dashboard();
		expect(report).toContain("Token Budget Manager Dashboard");
	});

	it("should render compact dashboard", () => {
		const tbm = new TbmManager();
		const compact = tbm.compactDashboard();
		expect(compact).toContain("TBM:");
	});

	it("should reset all subsystems", () => {
		const tbm = new TbmManager();
		tbm.recordUsage(1000, 500);
		tbm.responseCache.store("q", "a");
		tbm.reset();
		const data = tbm.dashboardData();
		expect(data.totalInputTokens).toBe(0);
	});

	it("should respect disabled config", () => {
		const tbm = new TbmManager({ enabled: false, response_cache: { enabled: false } });
		expect(tbm.checkCache("test")).toBeNull();
		expect(tbm.getCommDirective()).toBe("");
	});
});
