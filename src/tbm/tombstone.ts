/**
 * Conversation Tombstoning — compress old messages to minimal references.
 *
 * Old messages are replaced with tombstone entries that reference
 * the original content. Model can still look up originals if needed.
 *
 * Target: 85% context reduction.
 */

export interface TombstoneEntry {
	/** Original message index in conversation. */
	originalIndex: number;
	/** Role of the original message. */
	role: "user" | "assistant";
	/** One-line summary of the original content. */
	summary: string;
	/** Token count of original message. */
	originalTokens: number;
	/** Token count of tombstone (~10% of original). */
	tombstoneTokens: number;
	/** Hash of original content for lookup. */
	originalHash: string;
}

export interface TombstoneStats {
	/** Total messages tombstoned. */
	messagesTombstoned: number;
	/** Original total tokens. */
	originalTokens: number;
	/** Tombstone total tokens. */
	tombstoneTokens: number;
	/** Tokens saved. */
	tokensSaved: number;
	/** Compression ratio (tombstone/original). */
	compressionRatio: number;
}

import { hashContent, estimateTokens } from "./context-delta";

/**
 * Generate a one-line summary from message content.
 * Heuristic: first sentence or first 100 chars.
 */
function summarizeMessage(content: string): string {
	// Take first sentence or first 100 chars
	const firstSentence = content.match(/^[^.!?\n]{1,150}[.!?]?/);
	if (firstSentence) {
		const s = firstSentence[0].trim();
		return s.length > 120 ? s.slice(0, 117) + "..." : s;
	}
	return content.length > 100 ? content.slice(0, 97) + "..." : content;
}

/**
 * Build a tombstone line from an original message.
 * Format: `[Turn N - user/assistant] Summary...`
 */
function buildTombstoneLine(entry: TombstoneEntry): string {
	return `[Turn ${entry.originalIndex + 1} - ${entry.role}] ${entry.summary}`;
}

export class ConversationTombstoner {
	#tombstones: TombstoneEntry[] = [];
	#originals: Map<string, string> = new Map(); // hash → original content
	#afterTurns: number;
	#keepRecent: number;
	#stats: TombstoneStats = {
		messagesTombstoned: 0,
		originalTokens: 0,
		tombstoneTokens: 0,
		tokensSaved: 0,
		compressionRatio: 0,
	};

	constructor(afterTurns: number = 20, keepRecent: number = 5) {
		this.#afterTurns = afterTurns;
		this.#keepRecent = keepRecent;
	}

	/**
	 * Process conversation messages — tombstone old ones, keep recent.
	 * Returns the compressed conversation with tombstones replacing old messages.
	 */
	tombstone(messages: Array<{ role: "user" | "assistant"; content: string }>): {
		compressed: Array<{ role: "user" | "assistant"; content: string }>;
		tombstoned: number;
		tokensSaved: number;
	} {
		if (messages.length <= this.#keepRecent + this.#afterTurns) {
			return { compressed: messages, tombstoned: 0, tokensSaved: 0 };
		}

		const cutoff = messages.length - this.#keepRecent;
		const toTombstone = messages.slice(0, cutoff);
		const toKeep = messages.slice(cutoff);

		let totalOriginalTokens = 0;
		let totalTombstoneTokens = 0;
		let tombstoned = 0;

		const compressedTombstones: Array<{ role: "user" | "assistant"; content: string }> = [];

		for (let i = 0; i < toTombstone.length; i++) {
			const msg = toTombstone[i];
			const originalTokens = estimateTokens(msg.content);
			const summary = summarizeMessage(msg.content);
			const hash = hashContent(msg.content);

			// Store original for lookup
			this.#originals.set(hash, msg.content);

			const tombstoneTokens = estimateTokens(summary) + 5; // +5 for formatting

			this.#tombstones.push({
				originalIndex: i,
				role: msg.role,
				summary,
				originalTokens,
				tombstoneTokens,
				originalHash: hash,
			});

			totalOriginalTokens += originalTokens;
			totalTombstoneTokens += tombstoneTokens;
			tombstoned++;

			compressedTombstones.push({
				role: msg.role,
				content: buildTombstoneLine(this.#tombstones[this.#tombstones.length - 1]),
			});
		}

		const tokensSaved = totalOriginalTokens - totalTombstoneTokens;

		this.#stats.messagesTombstoned += tombstoned;
		this.#stats.originalTokens += totalOriginalTokens;
		this.#stats.tombstoneTokens += totalTombstoneTokens;
		this.#stats.tokensSaved += tokensSaved;
		this.#stats.compressionRatio = this.#stats.originalTokens > 0
			? this.#stats.tombstoneTokens / this.#stats.originalTokens
			: 0;

		return {
			compressed: [...compressedTombstones, ...toKeep],
			tombstoned,
			tokensSaved,
		};
	}

	/**
	 * Look up original content by tombstone hash.
	 * Returns null if not found.
	 */
	lookupOriginal(hash: string): string | null {
		return this.#originals.get(hash) ?? null;
	}

	/**
	 * Look up original by turn index.
	 */
	lookupByTurn(turnIndex: number): string | null {
		const entry = this.#tombstones.find((t) => t.originalIndex === turnIndex);
		if (!entry) return null;
		return this.#originals.get(entry.originalHash) ?? null;
	}

	/** Get stats snapshot. */
	get stats(): Readonly<TombstoneStats> {
		return { ...this.#stats };
	}

	/** Get all tombstone entries. */
	get entries(): ReadonlyArray<TombstoneEntry> {
		return this.#tombstones;
	}

	/** Reset tombstoner state. */
	reset(): void {
		this.#tombstones = [];
		this.#originals.clear();
		this.#stats = {
			messagesTombstoned: 0,
			originalTokens: 0,
			tombstoneTokens: 0,
			tokensSaved: 0,
			compressionRatio: 0,
		};
	}
}
