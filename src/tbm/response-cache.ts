/**
 * Response Cache — exact and semantic match for cached responses.
 *
 * - Exact match: hash(query) → cached response
 * - Semantic match: embedding similarity > 0.95
 * - TTL-based expiry
 */

import { createHash } from "node:crypto";
import { estimateTokens } from "./context-delta";

export interface CacheEntry {
	/** Hash of the query for exact match. */
	queryHash: string;
	/** Original query text. */
	query: string;
	/** Cached response. */
	response: string;
	/** When this entry was created. */
	createdAt: number;
	/** When this entry expires. */
	expiresAt: number;
	/** How many times this cache was hit. */
	hitCount: number;
	/** Token count of the cached response. */
	responseTokens: number;
}

export interface ResponseCacheStats {
	/** Total queries processed. */
	totalQueries: number;
	/** Exact cache hits. */
	exactHits: number;
	/** Semantic cache hits. */
	semanticHits: number;
	/** Cache misses. */
	misses: number;
	/** Total tokens saved by cache hits. */
	tokensSaved: number;
	/** Current cache size. */
	cacheSize: number;
	/** Hit rate (exact + semantic / total). */
	hitRate: number;
}

function hashQuery(query: string): string {
	return createHash("sha256").update(query.trim().toLowerCase()).digest("hex").slice(0, 16);
}

/**
 * Simple Jaccard similarity for semantic matching.
 * Uses word-level n-grams (bigrams) for comparison.
 */
function jaccardSimilarity(a: string, b: string): number {
	const bigramsA = getBigrams(a);
	const bigramsB = getBigrams(b);

	if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
	if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

	let intersection = 0;
	for (const bg of bigramsA) {
		if (bigramsB.has(bg)) intersection++;
	}

	const union = bigramsA.size + bigramsB.size - intersection;
	return union > 0 ? intersection / union : 0;
}

function getBigrams(text: string): Set<string> {
	const words = text.toLowerCase().trim().split(/\s+/);
	const bigrams = new Set<string>();
	for (let i = 0; i < words.length - 1; i++) {
		bigrams.add(`${words[i]}_${words[i + 1]}`);
	}
	return bigrams;
}

export class ResponseCache {
	#cache: Map<string, CacheEntry> = new Map();
	#ttlMs: number;
	#maxEntries: number;
	#similarityThreshold: number;
	#stats: ResponseCacheStats = {
		totalQueries: 0,
		exactHits: 0,
		semanticHits: 0,
		misses: 0,
		tokensSaved: 0,
		cacheSize: 0,
		hitRate: 0,
	};

	constructor(ttlSeconds: number = 3600, maxEntries: number = 100, similarityThreshold: number = 0.95) {
		this.#ttlMs = ttlSeconds * 1000;
		this.#maxEntries = maxEntries;
		this.#similarityThreshold = similarityThreshold;
	}

	/**
	 * Look up a cached response for a query.
	 * Tries exact match first, then semantic match.
	 */
	get(query: string): { hit: boolean; response?: string; matchType?: "exact" | "semantic" } {
		this.#stats.totalQueries++;
		const now = Date.now();

		// Clean expired entries lazily
		this.#cleanExpired(now);

		const qHash = hashQuery(query);

		// 1. Exact match
		const exact = this.#cache.get(qHash);
		if (exact && exact.expiresAt > now) {
			exact.hitCount++;
			this.#stats.exactHits++;
			this.#stats.tokensSaved += exact.responseTokens;
			this.#updateHitRate();
			return { hit: true, response: exact.response, matchType: "exact" };
		}

		// 2. Semantic match (Jaccard on bigrams)
		for (const [, entry] of this.#cache) {
			if (entry.expiresAt <= now) continue;
			const sim = jaccardSimilarity(query, entry.query);
			if (sim >= this.#similarityThreshold) {
				entry.hitCount++;
				this.#stats.semanticHits++;
				this.#stats.tokensSaved += entry.responseTokens;
				this.#updateHitRate();
				return { hit: true, response: entry.response, matchType: "semantic" };
			}
		}

		this.#stats.misses++;
		this.#updateHitRate();
		return { hit: false };
	}

	/**
	 * Store a response in the cache.
	 */
	set(query: string, response: string): void {
		const now = Date.now();
		const qHash = hashQuery(query);

		// Evict oldest if at capacity
		if (this.#cache.size >= this.#maxEntries) {
			this.#evictOldest();
		}

		this.#cache.set(qHash, {
			queryHash: qHash,
			query,
			response,
			createdAt: now,
			expiresAt: now + this.#ttlMs,
			hitCount: 0,
			responseTokens: estimateTokens(response),
		});

		this.#stats.cacheSize = this.#cache.size;
	}

	/** Get stats snapshot. */
	get stats(): Readonly<ResponseCacheStats> {
		return { ...this.#stats };
	}

	/** Clear all cache entries. */
	clear(): void {
		this.#cache.clear();
		this.#stats.cacheSize = 0;
	}

	/** Reset stats and cache. */
	reset(): void {
		this.#cache.clear();
		this.#stats = {
			totalQueries: 0,
			exactHits: 0,
			semanticHits: 0,
			misses: 0,
			tokensSaved: 0,
			cacheSize: 0,
			hitRate: 0,
		};
	}

	#cleanExpired(now: number): void {
		for (const [key, entry] of this.#cache) {
			if (entry.expiresAt <= now) {
				this.#cache.delete(key);
			}
		}
		this.#stats.cacheSize = this.#cache.size;
	}

	#evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestTime = Infinity;

		for (const [key, entry] of this.#cache) {
			if (entry.createdAt < oldestTime) {
				oldestTime = entry.createdAt;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.#cache.delete(oldestKey);
		}
	}

	#updateHitRate(): void {
		const hits = this.#stats.exactHits + this.#stats.semanticHits;
		this.#stats.hitRate = this.#stats.totalQueries > 0 ? hits / this.#stats.totalQueries : 0;
	}
}
