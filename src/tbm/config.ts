/**
 * TBM Configuration — all Token Budget Manager settings.
 *
 * Loaded from .sns-myagent/config.yaml under the `tbm:` key.
 * Every subsystem reads its own section; the manager checks `tbm.enabled` first.
 */

export interface TbmConfig {
	/** Master switch. All TBM subsystems are inactive when false. */
	enabled: boolean;

	/** Context Delta Caching — send only changed context each turn. */
	context_delta: {
		enabled: boolean;
	};

	/** Multi-Resolution Context Pyramid — load context in escalating levels. */
	pyramid: {
		enabled: boolean;
		/** Starting pyramid level (0-4). Default 1. */
		start_level: number;
		/** Max level to auto-escalate to. Default 4. */
		max_level: number;
	};

	/** Lazy Skill Loading — inject skill names only, load on-demand. */
	lazy_skills: {
		enabled: boolean;
		/** Max tokens to spend on skill names in prompt. Default 200. */
		name_budget: number;
		/** Max full skills to load per turn. Default 3. */
		max_per_turn: number;
	};

	/** Tool Output Auto-Compress — truncate/summarize tool output. */
	compress: {
		enabled: boolean;
		/** Per-tool token budgets. */
		budgets: {
			terminal: number;
			read_file: number;
			web_extract: number;
			search_files: number;
			default: number;
		};
	};

	/** Communication Mode — controls response verbosity. */
	comm_mode: "auto" | "caveman" | "normal" | "verbose";

	/** Conversation Tombstoning — compress old messages. */
	tombstone: {
		enabled: boolean;
		/** Tombstone messages older than N turns. Default 20. */
		after_turns: number;
		/** Keep at least N recent messages untouched. Default 5. */
		keep_recent: number;
	};

	/** Response Cache — exact and semantic match. */
	response_cache: {
		enabled: boolean;
		/** Cache TTL in seconds. Default 3600. */
		ttl_seconds: number;
		/** Max cached responses. Default 100. */
		max_entries: number;
		/** Semantic similarity threshold (0-1). Default 0.95. */
		similarity_threshold: number;
	};
}

/** Default TBM configuration — everything enabled with sensible defaults. */
export const DEFAULT_TBM_CONFIG: TbmConfig = {
	enabled: true,
	context_delta: { enabled: true },
	pyramid: {
		enabled: true,
		start_level: 1,
		max_level: 4,
	},
	lazy_skills: {
		enabled: true,
		name_budget: 200,
		max_per_turn: 3,
	},
	compress: {
		enabled: true,
		budgets: {
			terminal: 500,
			read_file: 800,
			web_extract: 1000,
			search_files: 300,
			default: 500,
		},
	},
	comm_mode: "auto",
	tombstone: {
		enabled: true,
		after_turns: 20,
		keep_recent: 5,
	},
	response_cache: {
		enabled: true,
		ttl_seconds: 3600,
		max_entries: 100,
		similarity_threshold: 0.95,
	},
};

/**
 * Merge user config over defaults. Unknown keys are ignored.
 * Deep-merges nested objects so partial overrides work.
 */
export function resolveTbmConfig(overrides?: Partial<TbmConfig>): TbmConfig {
	if (!overrides) return { ...DEFAULT_TBM_CONFIG };
	return deepMerge(DEFAULT_TBM_CONFIG as unknown as Record<string, unknown>, overrides as unknown as Record<string, unknown>) as unknown as TbmConfig;
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = { ...base };
	for (const key of Object.keys(over)) {
		if (
			over[key] !== null &&
			typeof over[key] === "object" &&
			!Array.isArray(over[key]) &&
			typeof base[key] === "object" &&
			base[key] !== null &&
			!Array.isArray(base[key])
		) {
			result[key] = deepMerge(base[key] as Record<string, unknown>, over[key] as Record<string, unknown>);
		} else if (over[key] !== undefined) {
			result[key] = over[key];
		}
	}
	return result;
}
