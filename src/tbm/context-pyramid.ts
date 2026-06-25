/**
 * Multi-Resolution Context Pyramid — load context in escalating levels.
 *
 * Each level adds more context. Auto-escalates when response quality drops.
 *
 * Level 0: Identity only (~100 tokens) — Simple Q&A
 * Level 1: + Last 3 messages (~500 tokens) — Continuation
 * Level 2: + Relevant memories (~1,000 tokens) — Contextual tasks
 * Level 3: + Relevant skills (~2,000 tokens) — Complex tasks
 * Level 4: + Full history (~5,000 tokens) — Deep research
 */

export type PyramidLevel = 0 | 1 | 2 | 3 | 4;

export interface PyramidLevelConfig {
	level: PyramidLevel;
	/** Human-readable label. */
	label: string;
	/** Approximate token budget for this level. */
	tokenBudget: number;
	/** What content is included at this level. */
	includes: string[];
}

/** Pyramid level definitions. */
export const PYRAMID_LEVELS: ReadonlyMap<PyramidLevel, PyramidLevelConfig> = new Map([
	[0, { level: 0, label: "Identity", tokenBudget: 100, includes: ["identity"] }],
	[1, { level: 1, label: "Continuation", tokenBudget: 500, includes: ["identity", "last_3_messages"] }],
	[2, { level: 2, label: "Contextual", tokenBudget: 1000, includes: ["identity", "last_3_messages", "relevant_memories"] }],
	[3, { level: 3, label: "Complex", tokenBudget: 2000, includes: ["identity", "last_3_messages", "relevant_memories", "relevant_skills"] }],
	[4, { level: 4, label: "Deep Research", tokenBudget: 5000, includes: ["identity", "last_3_messages", "relevant_memories", "relevant_skills", "full_history"] }],
]);

export interface PyramidStats {
	/** Current active level. */
	currentLevel: PyramidLevel;
	/** Total escalations this session. */
	escalations: number;
	/** Total de-escalations this session. */
	deescalations: number;
	/** Tokens consumed at each level. */
	levelTokens: Record<PyramidLevel, number>;
}

/**
 * Analyze task complexity to determine initial pyramid level.
 * Returns 0-4 based on heuristics.
 */
export function analyzeTaskComplexity(message: string): PyramidLevel {
	const lower = message.toLowerCase();
	const len = message.length;

	// Simple Q&A triggers
	if (len < 50 && !lower.includes("?") && !lower.includes("how") && !lower.includes("why")) {
		return 0;
	}

	// Complex task indicators
	const complexKeywords = ["implement", "debug", "refactor", "architecture", "design", "explain in detail", "compare", "analyze"];
	const hasComplexKeyword = complexKeywords.some((kw) => lower.includes(kw));

	// Research indicators
	const researchKeywords = ["research", "investigate", "comprehensive", "all options", "trade-offs", "deep dive"];
	const hasResearchKeyword = researchKeywords.some((kw) => lower.includes(kw));

	if (hasResearchKeyword && len > 200) return 4;
	if (hasComplexKeyword && len > 100) return 3;
	if (len > 50 || lower.includes("?")) return 2;
	return 1;
}

export class ContextPyramid {
	#currentLevel: PyramidLevel;
	#maxLevel: PyramidLevel;
	#stats: PyramidStats;
	#recentQuality: number[] = []; // last N response quality scores (0-1)

	constructor(startLevel: PyramidLevel = 1, maxLevel: PyramidLevel = 4) {
		this.#currentLevel = startLevel;
		this.#maxLevel = maxLevel;
		this.#stats = {
			currentLevel: startLevel,
			escalations: 0,
			deescalations: 0,
			levelTokens: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
		};
	}

	/** Get the current pyramid level config. */
	get current(): PyramidLevelConfig {
		return PYRAMID_LEVELS.get(this.#currentLevel)!;
	}

	/** Get current level number. */
	get level(): PyramidLevel {
		return this.#currentLevel;
	}

	/** Get stats snapshot. */
	get stats(): Readonly<PyramidStats> {
		return { ...this.#stats };
	}

	/**
	 * Determine context level for a new message.
	 * Auto-escalates based on task complexity if level was set to auto.
	 */
	resolveLevel(message: string): PyramidLevel {
		const suggested = analyzeTaskComplexity(message);
		return Math.min(suggested, this.#maxLevel) as PyramidLevel;
	}

	/**
	 * Set level explicitly (from /mode command or auto-detect).
	 */
	setLevel(level: PyramidLevel): void {
		if (level < 0 || level > 4) return;
		if (level > this.#maxLevel) level = this.#maxLevel;

		if (level > this.#currentLevel) {
			this.#stats.escalations++;
		} else if (level < this.#currentLevel) {
			this.#stats.deescalations++;
		}

		this.#currentLevel = level;
		this.#stats.currentLevel = level;
	}

	/**
	 * Report response quality to inform escalation decisions.
	 * Quality: 0 = garbage, 1 = perfect.
	 */
	reportQuality(quality: number): void {
		this.#recentQuality.push(Math.max(0, Math.min(1, quality)));
		if (this.#recentQuality.length > 5) {
			this.#recentQuality.shift();
		}

		// If average quality < 0.5 and not at max, escalate
		const avg = this.#recentQuality.reduce((a, b) => a + b, 0) / this.#recentQuality.length;
		if (avg < 0.5 && this.#currentLevel < this.#maxLevel) {
			this.setLevel((this.#currentLevel + 1) as PyramidLevel);
		}
	}

	/**
	 * Record token usage at the current level.
	 */
	recordUsage(tokens: number): void {
		this.#stats.levelTokens[this.#currentLevel] += tokens;
	}

	/**
	 * Filter context content based on current pyramid level.
	 * Returns only the content appropriate for the level.
	 */
	filterContext(context: {
		identity?: string;
		recentMessages?: string[];
		memories?: string[];
		skills?: string[];
		fullHistory?: string;
	}): string {
		const parts: string[] = [];
		const levelConfig = PYRAMID_LEVELS.get(this.#currentLevel)!;

		if (levelConfig.includes.includes("identity") && context.identity) {
			parts.push(context.identity);
		}

		if (levelConfig.includes.includes("last_3_messages") && context.recentMessages) {
			parts.push(context.recentMessages.slice(-3).join("\n"));
		}

		if (levelConfig.includes.includes("relevant_memories") && context.memories) {
			parts.push(context.memories.join("\n"));
		}

		if (levelConfig.includes.includes("relevant_skills") && context.skills) {
			parts.push(context.skills.join("\n"));
		}

		if (levelConfig.includes.includes("full_history") && context.fullHistory) {
			parts.push(context.fullHistory);
		}

		return parts.join("\n\n");
	}

	/** Reset pyramid state. */
	reset(): void {
		this.#currentLevel = 1;
		this.#recentQuality = [];
		this.#stats = {
			currentLevel: 1,
			escalations: 0,
			deescalations: 0,
			levelTokens: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
		};
	}
}
