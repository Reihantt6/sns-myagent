/**
 * Context Delta Caching — send only changed context each turn.
 *
 * Static prefix (system prompt, tools, identity) is cached at provider level.
 * Dynamic suffix (recent messages, tool output) is sent as delta.
 *
 * Target: 60-80% input token savings after turn 1.
 */

import { createHash } from "node:crypto";

export interface ContextDeltaStats {
	/** Total turns processed. */
	turns: number;
	/** Turns where cache hit (static prefix unchanged). */
	cache_hits: number;
	/** Estimated tokens saved by not resending static prefix. */
	tokens_saved: number;
	/** Total input tokens consumed. */
	total_input_tokens: number;
}

export interface ContextSegment {
	/** Segment type — static rarely changes, dynamic changes every turn. */
	kind: "static" | "dynamic";
	/** Content hash for change detection. */
	hash: string;
	/** Token count estimate (chars / 4). */
	tokens: number;
	/** The actual content. */
	content: string;
}

/**
 * Hash content for change detection. Uses SHA-256 truncated to 16 hex chars.
 */
export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Estimate token count from character count. Rule of thumb: ~4 chars per token.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Split full context into static and dynamic segments.
 *
 * Static: system prompt + tool definitions + identity.
 * Dynamic: conversation messages + tool output.
 */
export function splitContext(fullContext: string): { staticPart: string; dynamicPart: string } {
	// Look for the conversation boundary marker
	const markers = ["<conversation>", "---\n\nUser:", "## Conversation", "Human:", "Assistant:"];
	let splitIdx = -1;

	for (const marker of markers) {
		const idx = fullContext.indexOf(marker);
		if (idx > 0) {
			splitIdx = idx;
			break;
		}
	}

	// Fallback: split at 60% mark (static usually larger)
	if (splitIdx < 0) {
		splitIdx = Math.floor(fullContext.length * 0.6);
	}

	return {
		staticPart: fullContext.slice(0, splitIdx),
		dynamicPart: fullContext.slice(splitIdx),
	};
}

export class ContextDeltaCache {
	#cachedStaticHash: string | null = null;
	#stats: ContextDeltaStats = {
		turns: 0,
		cache_hits: 0,
		tokens_saved: 0,
		total_input_tokens: 0,
	};

	/**
	 * Process a new turn's context. Returns delta info:
	 * - `staticChanged`: whether the static prefix needs resending
	 * - `deltaContent`: only the dynamic part (if static unchanged)
	 * - `fullContent`: full content (if static changed)
	 * - `tokensSaved`: estimated tokens saved this turn
	 */
	processTurn(fullContext: string): {
		staticChanged: boolean;
		content: string;
		tokensSaved: number;
	} {
		this.#stats.turns++;

		const { staticPart, dynamicPart } = splitContext(fullContext);
		const staticHash = hashContent(staticPart);
		const dynamicTokens = estimateTokens(dynamicPart);
		const staticTokens = estimateTokens(staticPart);

		this.#stats.total_input_tokens += dynamicTokens;

		if (this.#cachedStaticHash === staticHash) {
			// Cache HIT — static prefix unchanged, send only delta
			this.#stats.cache_hits++;
			this.#stats.tokens_saved += staticTokens;
			return {
				staticChanged: false,
				content: dynamicPart,
				tokensSaved: staticTokens,
			};
		}

		// Cache MISS — static prefix changed, resend everything
		this.#cachedStaticHash = staticHash;
		this.#stats.total_input_tokens += staticTokens;

		return {
			staticChanged: true,
			content: fullContext,
			tokensSaved: 0,
		};
	}

	/** Get current stats snapshot. */
	get stats(): Readonly<ContextDeltaStats> {
		return { ...this.#stats };
	}

	/** Cache hit rate (0-1). */
	get hitRate(): number {
		if (this.#stats.turns === 0) return 0;
		return this.#stats.cache_hits / this.#stats.turns;
	}

	/** Reset cache state (e.g. on session reset). */
	reset(): void {
		this.#cachedStaticHash = null;
		this.#stats = { turns: 0, cache_hits: 0, tokens_saved: 0, total_input_tokens: 0 };
	}
}
