/**
 * Config schema for SNS-MyAgent (.sns-myagent/config.json)
 *
 * Phase 2A: minimal schema. No external validators (avoids new deps).
 * Validation is done manually in loader.validateConfig().
 */

export interface ModelConfig {
	/** Provider id, e.g. "openai", "anthropic", "google", "openrouter". */
	provider: string;
	/** Concrete model id, e.g. "gpt-4o-mini", "claude-3-5-sonnet". */
	model: string;
	/** Sampling temperature 0..2. */
	temperature: number;
	/** Max tokens for a single completion. */
	maxTokens: number;
}

export interface TelegramConfig {
	/** Bot token from @BotFather. Empty string = not configured. */
	token: string;
	/** Allowed chat IDs (numeric). Empty = no restrictions yet. */
	allowedChatIds: number[];
	/** Polling interval in ms. */
	pollIntervalMs: number;
}

export interface MemoryConfig {
	/** Path to memory store file (relative to .sns-myagent/). */
	path: string;
	/** Max number of entries to retain. */
	maxEntries: number;
	/** Auto-summarize old entries when count exceeds threshold. */
	autoSummarize: boolean;
}

export interface Config {
	/** Schema version for migrations. */
	version: 1;
	/** User-facing agent display name. */
	agentName: string;
	model: ModelConfig;
	telegram: TelegramConfig;
	memory: MemoryConfig;
	/** Free-form additional settings (Phase 2B+). */
	extra?: Record<string, unknown>;
}

/** Type guard: string is a non-empty trimmed string. */
function isNonEmptyString(x: unknown): x is string {
	return typeof x === "string" && x.trim().length > 0;
}

/** Type guard: x is a finite number. */
function isFiniteNumber(x: unknown): x is number {
	return typeof x === "number" && Number.isFinite(x);
}

/**
 * Validate a parsed JSON object against the Config schema.
 * Returns the typed config if valid, throws Error with descriptive message otherwise.
 */
export function validateConfig(raw: unknown): Config {
	if (typeof raw !== "object" || raw === null) {
		throw new Error("config must be a JSON object");
	}
	const r = raw as Record<string, unknown>;

	if (r.version !== 1) {
		throw new Error(`config.version must be 1 (got ${JSON.stringify(r.version)})`);
	}
	if (!isNonEmptyString(r.agentName)) {
		throw new Error("config.agentName must be a non-empty string");
	}

	const m = r.model as Record<string, unknown> | undefined;
	if (typeof m !== "object" || m === null) {
		throw new Error("config.model must be an object");
	}
	if (!isNonEmptyString(m.provider)) throw new Error("config.model.provider required");
	if (!isNonEmptyString(m.model)) throw new Error("config.model.model required");
	if (!isFiniteNumber(m.temperature) || m.temperature < 0 || m.temperature > 2) {
		throw new Error("config.model.temperature must be 0..2");
	}
	if (!isFiniteNumber(m.maxTokens) || m.maxTokens <= 0 || !Number.isInteger(m.maxTokens)) {
		throw new Error("config.model.maxTokens must be a positive integer");
	}

	const t = r.telegram as Record<string, unknown> | undefined;
	if (typeof t !== "object" || t === null) {
		throw new Error("config.telegram must be an object");
	}
	if (typeof t.token !== "string") throw new Error("config.telegram.token must be a string");
	if (!Array.isArray(t.allowedChatIds) || !t.allowedChatIds.every((n) => isFiniteNumber(n))) {
		throw new Error("config.telegram.allowedChatIds must be number[]");
	}
	if (!isFiniteNumber(t.pollIntervalMs) || t.pollIntervalMs < 100) {
		throw new Error("config.telegram.pollIntervalMs must be >= 100");
	}

	const mem = r.memory as Record<string, unknown> | undefined;
	if (typeof mem !== "object" || mem === null) {
		throw new Error("config.memory must be an object");
	}
	if (!isNonEmptyString(mem.path)) throw new Error("config.memory.path required");
	if (!isFiniteNumber(mem.maxEntries) || mem.maxEntries <= 0 || !Number.isInteger(mem.maxEntries)) {
		throw new Error("config.memory.maxEntries must be a positive integer");
	}
	if (typeof mem.autoSummarize !== "boolean") {
		throw new Error("config.memory.autoSummarize must be boolean");
	}

	const extra = r.extra;
	if (extra !== undefined && (typeof extra !== "object" || extra === null || Array.isArray(extra))) {
		throw new Error("config.extra must be an object if present");
	}

	return {
		version: 1,
		agentName: r.agentName as string,
		model: {
			provider: m.provider as string,
			model: m.model as string,
			temperature: m.temperature as number,
			maxTokens: m.maxTokens as number,
		},
		telegram: {
			token: t.token as string,
			allowedChatIds: t.allowedChatIds as number[],
			pollIntervalMs: t.pollIntervalMs as number,
		},
		memory: {
			path: mem.path as string,
			maxEntries: mem.maxEntries as number,
			autoSummarize: mem.autoSummarize as boolean,
		},
		extra: extra as Record<string, unknown> | undefined,
	};
}