/**
 * Token Dashboard — `/tokens` command implementation.
 *
 * Shows session stats: duration, tokens, cost, cache hit rate,
 * pyramid level, communication mode, compression stats.
 */

import type { TbmManager } from "./index";

export interface DashboardData {
	sessionDuration: string;
	totalInputTokens: number;
	totalOutputTokens: number;
	cachedTokens: number;
	estimatedCost: string;
	cacheHitRate: string;
	pyramidLevel: number;
	pyramidLabel: string;
	commMode: string;
	compressionRatio: string;
	tokensSaved: string;
	tombstonesActive: number;
	responseCacheSize: number;
	skillsLoaded: string;
}

/**
 * Format a number with K/M suffix.
 */
function formatNumber(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

/**
 * Format duration from milliseconds. Negative or zero durations (clock
 * skew, fresh session) render as `0s` rather than a negative label.
 */
function formatDuration(ms: number): string {
	const seconds = Math.floor(Math.max(0, ms) / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (minutes < 60) return `${minutes}m ${secs}s`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
}

/**
 * Estimate cost from token counts.
 * Rough estimate: $3/1M input, $15/1M output (Claude Sonnet class).
 * Negative counters (should never happen) are clamped to zero so the
 * dashboard can never render a negative cost.
 */
function estimateCost(inputTokens: number, outputTokens: number): string {
	const inputCost = (Math.max(0, inputTokens) / 1_000_000) * 3;
	const outputCost = (Math.max(0, outputTokens) / 1_000_000) * 15;
	const total = inputCost + outputCost;
	if (total < 0.01) return "<$0.01";
	return `$${total.toFixed(3)}`;
}

/**
 * Build dashboard data from TBM manager state.
 */
export function buildDashboard(mgr: TbmManager, sessionStartTime: number): DashboardData {
	const deltaStats = mgr.contextDelta.stats;
	const pyramidStats = mgr.pyramid.stats;
	const compressStats = mgr.compressor.stats;
	const cacheStats = mgr.responseCache.stats;
	const tombstoneStats = mgr.tombstoner.stats;
	const skillStats = mgr.lazySkills.stats;

	const totalSaved = deltaStats.tokens_saved
		+ compressStats.tokensSaved
		+ tombstoneStats.tokensSaved
		+ cacheStats.tokensSaved
		+ skillStats.tokensSaved;

	return {
		sessionDuration: formatDuration(Date.now() - sessionStartTime),
		totalInputTokens: Math.max(0, deltaStats.total_input_tokens),
		totalOutputTokens: 0, // tracked by provider
		cachedTokens: Math.max(0, deltaStats.tokens_saved),
		estimatedCost: estimateCost(deltaStats.total_input_tokens, 0),
		cacheHitRate: `${(Math.max(0, deltaStats.cache_hits) / Math.max(1, deltaStats.turns) * 100).toFixed(0)}%`,
		pyramidLevel: pyramidStats.currentLevel,
		pyramidLabel: pyramidStats.currentLevel.toString(),
		commMode: mgr.commMode.effective,
		compressionRatio: `${(compressStats.totalOutputs > 0 ? (compressStats.compressed / compressStats.totalOutputs * 100) : 0).toFixed(0)}%`,
		tokensSaved: formatNumber(Math.max(0, totalSaved)),
		tombstonesActive: Math.max(0, tombstoneStats.messagesTombstoned),
		responseCacheSize: Math.max(0, cacheStats.cacheSize),
		skillsLoaded: `${Math.max(0, skillStats.loadedOnDemand)}/${Math.max(0, skillStats.totalAvailable)}`,
	};
}

/**
 * Render dashboard as formatted text for display.
 */
export function renderDashboard(data: DashboardData): string {
	return `╔══════════════════════════════════════╗
║       🧠 Token Budget Manager       ║
╠══════════════════════════════════════╣
║ Session     ${data.sessionDuration.padEnd(25)}║
║ Input       ${String(data.totalInputTokens).padEnd(25)}║
║ Cached      ${String(data.cachedTokens).padEnd(25)}║
║ Est. Cost   ${data.estimatedCost.padEnd(25)}║
╠══════════════════════════════════════╣
║ 📊 Context Delta                    ║
║ Cache Hit   ${data.cacheHitRate.padEnd(25)}║
╠══════════════════════════════════════╣
║ 🔺 Pyramid                          ║
║ Level       ${String(data.pyramidLevel).padEnd(25)}║
╠══════════════════════════════════════╣
║ 💬 Mode       ${data.commMode.padEnd(23)}║
╠══════════════════════════════════════╣
║ 🗜️  Compression ${data.compressionRatio.padEnd(22)}║
║ 💾 Saved      ${data.tokensSaved.padEnd(23)}║
╠══════════════════════════════════════╣
║ 🗂  Tombstones ${String(data.tombstonesActive).padEnd(23)}║
║ 📦 Cache Size ${String(data.responseCacheSize).padEnd(23)}║
║ 🎯 Skills     ${data.skillsLoaded.padEnd(23)}║
╚══════════════════════════════════════╝`;
}

/**
 * Render dashboard as compact one-liner for status bar.
 */
export function renderCompactDashboard(data: DashboardData): string {
	return `🧠 TBM | L${data.pyramidLevel} ${data.commMode} | Δ${data.cacheHitRate} | 🗜${data.compressionRatio} | 💾${data.tokensSaved}`;
}
