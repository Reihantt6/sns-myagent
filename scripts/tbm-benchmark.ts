/**
 * TBM benchmark — subsystem-level, OFF vs ON.
 *
 * IMPORTANT SCOPE NOTE: TBM is NOT wired into the main agent loop (see
 * AUDIT-REPORT.md). This benchmark therefore measures the TbmManager
 * subsystem directly on a simulated 20-turn conversation. It does NOT
 * measure an end-to-end agent session; any savings claim must stay scoped
 * to this harness.
 *
 * Run: bun scripts/tbm-benchmark.ts
 */

import { performance } from "node:perf_hooks";
import { TbmManager } from "../src/tbm/index";
import { estimateTokens } from "../src/tbm/context-delta";

const TURNS = 20;
const TOOL_OUTPUT_SIZE = 4000; // chars per tool output

function makeConversationTurn(i: number): { message: string; fullContext: string; toolOutput: string } {
	const message = `user turn ${i}: fix the ${["parser", "renderer", "storage", "auth"][i % 4]} bug and verify it works`;
	const dynamic = `user: ${message}\nassistant: handled turn ${i}`;
	const fullContext = "system prompt ".repeat(400) + "\n<conversation>\n" + dynamic;
	const toolOutput = `tool output line ${i} `.repeat(TOOL_OUTPUT_SIZE / 20);
	return { message, fullContext, toolOutput };
}

interface TurnStats {
	contentTokens: number;
	directiveTokens: number;
	tokensSavedThisTurn: number;
	deltaCacheHit: boolean;
	compressed: boolean;
	cacheHit: boolean;
	tombstoned: number;
}

const FULLY_DISABLED_CONFIG = {
	enabled: false,
	context_delta: { enabled: false },
	pyramid: { enabled: false },
	lazy_skills: { enabled: false },
	compress: { enabled: false },
	tombstone: { enabled: false },
	response_cache: { enabled: false },
};

function runScenario(tbmEnabled: boolean): { turns: TurnStats[]; totalMs: number } {
	// OFF must disable every subsystem: the master switch alone does not gate
	// compressToolOutput/cacheResponse/tombstoneMessages (see tbm-audit.test.ts
	// "DOCUMENTED GAP"). This keeps the OFF baseline truly inert.
	const tbm = new TbmManager(tbmEnabled ? undefined : FULLY_DISABLED_CONFIG);
	const start = performance.now();
	const turns: TurnStats[] = [];

	for (let i = 0; i < TURNS; i++) {
		const { message, fullContext, toolOutput } = makeConversationTurn(i);

		// Re-process the previous turn's message once so the response cache can
		// actually hit (otherwise cacheResponse always runs after the get).
		const replay = i > 0 && i % 2 === 1 ? makeConversationTurn(i - 1).message : message;

		const cacheStatsBefore = tbm.responseCache.stats.exactHits + tbm.responseCache.stats.semanticHits;
		const turn = tbm.processTurn(replay, fullContext);
		const cacheStatsAfter = tbm.responseCache.stats.exactHits + tbm.responseCache.stats.semanticHits;
		const cacheHitThisTurn = cacheStatsAfter > cacheStatsBefore;
		const compressed = tbm.compressToolOutput("terminal", toolOutput);
		tbm.cacheResponse(message, "cached response for " + message);
		const tombstoned = tbm.tombstoneMessages(
			Array.from({ length: 40 }, (_, j) => ({
				role: (j % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
				content: `turn ${j} content with enough detail to be tombstoned later`,
			})),
		).tombstoned;

		turns.push({
			contentTokens: estimateTokens(turn.content),
			directiveTokens: estimateTokens(turn.directive),
			tokensSavedThisTurn: turn.tokensSavedThisTurn,
			deltaCacheHit: turn.deltaCacheHit,
			compressed: compressed.compressed,
			cacheHit: cacheHitThisTurn,
			tombstoned,
		});
	}

	return { turns, totalMs: performance.now() - start };
}

function summarize(label: string, result: { turns: TurnStats[]; totalMs: number }): void {
	const contentTokens = result.turns.reduce((sum, t) => sum + t.contentTokens, 0);
	const directiveTokens = result.turns.reduce((sum, t) => sum + t.directiveTokens, 0);
	const saved = result.turns.reduce((sum, t) => sum + t.tokensSavedThisTurn, 0);
	const deltaHits = result.turns.filter(t => t.deltaCacheHit).length;
	const compressed = result.turns.filter(t => t.compressed).length;
	const cacheHits = result.turns.filter(t => t.cacheHit).length;
	const tombstones = result.turns.reduce((sum, t) => sum + t.tombstoned, 0);

	console.log(`\n=== ${label} ===`);
	console.log(`total content tokens sent:        ${contentTokens}`);
	console.log(`total directive tokens:           ${directiveTokens}`);
	console.log(`tokens reported saved by TBM:     ${saved}`);
	console.log(`context-delta cache hits:         ${deltaHits}/${result.turns.length}`);
	console.log(`tool outputs compressed:          ${compressed}/${result.turns.length}`);
	console.log(`response cache hits:              ${cacheHits}/${result.turns.length}`);
	console.log(`messages tombstoned:              ${tombstones}`);
	console.log(`latency (subsystem calls only):   ${result.totalMs.toFixed(1)} ms`);
}	const off = runScenario(false);
	const on = runScenario(true);


summarize("TBM OFF", off);
summarize("TBM ON", on);

const savingsPct =
	off.turns.reduce((s, t) => s + t.contentTokens, 0) > 0
		? ((off.turns.reduce((s, t) => s + t.contentTokens, 0) - on.turns.reduce((s, t) => s + t.contentTokens, 0)) /
				off.turns.reduce((s, t) => s + t.contentTokens, 0)) *
			100
		: 0;

console.log(`\ncontent token delta (OFF - ON): ${off.turns.reduce((s, t) => s + t.contentTokens, 0) - on.turns.reduce((s, t) => s + t.contentTokens, 0)} (${savingsPct.toFixed(1)}% fewer on-wire content tokens)`);
console.log("NOTE: this measures the TBM harness only, not an end-to-end agent session.");
