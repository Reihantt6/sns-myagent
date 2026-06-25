/**
 * TBM Manager — coordinates all Token Budget Manager subsystems.
 *
 * Single entry point for the session/agent loop to interact with TBM.
 * Each subsystem is independently toggleable via config.
 *
 * Usage:
 *   const mgr = new TbmManager(config);
 *   const ctx = mgr.processTurn(message, fullContext);
 *   // use ctx.content, ctx.directive, etc.
 */

import { type TbmConfig, DEFAULT_TBM_CONFIG, resolveTbmConfig } from "./config";
import { ContextDeltaCache, estimateTokens } from "./context-delta";
import { ContextPyramid, type PyramidLevel } from "./context-pyramid";
import { LazySkillLoader, type SkillEntry } from "./lazy-skills";
import { ToolOutputCompressor } from "./tool-compress";
import { CommunicationModeManager, type CommMode } from "./comm-modes";
import { ConversationTombstoner } from "./tombstone";
import { ResponseCache } from "./response-cache";
import { buildDashboard, renderDashboard, renderCompactDashboard, type DashboardData } from "./dashboard";

export type { TbmConfig } from "./config";
export type { ContextDeltaStats } from "./context-delta";
export type { PyramidLevel, PyramidStats } from "./context-pyramid";
export type { SkillEntry, LazySkillStats } from "./lazy-skills";
export type { CompressStats } from "./tool-compress";
export type { CommMode } from "./comm-modes";
export type { TombstoneStats } from "./tombstone";
export type { ResponseCacheStats } from "./response-cache";
export type { DashboardData } from "./dashboard";

export interface TurnResult {
	/** Content to send (possibly delta-compressed). */
	content: string;
	/** Communication mode directive to inject into system prompt. */
	directive: string;
	/** Current pyramid level. */
	pyramidLevel: PyramidLevel;
	/** Tokens saved this turn across all subsystems. */
	tokensSavedThisTurn: number;
	/** Whether context delta cache hit. */
	deltaCacheHit: boolean;
}

export class TbmManager {
	readonly #config: TbmConfig;
	readonly #contextDelta: ContextDeltaCache;
	readonly #pyramid: ContextPyramid;
	readonly #lazySkills: LazySkillLoader;
	readonly #compressor: ToolOutputCompressor;
	readonly #commMode: CommunicationModeManager;
	readonly #tombstoner: ConversationTombstoner;
	readonly #responseCache: ResponseCache;
	readonly #sessionStartTime: number;

	constructor(config?: Partial<TbmConfig>) {
		this.#config = resolveTbmConfig(config);
		this.#contextDelta = new ContextDeltaCache();
		this.#pyramid = new ContextPyramid(
			this.#config.pyramid.start_level as PyramidLevel,
			this.#config.pyramid.max_level as PyramidLevel,
		);
		this.#lazySkills = new LazySkillLoader();
		this.#compressor = new ToolOutputCompressor(this.#config.compress.budgets);
		this.#commMode = new CommunicationModeManager(this.#config.comm_mode);
		this.#tombstoner = new ConversationTombstoner(
			this.#config.tombstone.after_turns,
			this.#config.tombstone.keep_recent,
		);
		this.#responseCache = new ResponseCache(
			this.#config.response_cache.ttl_seconds,
			this.#config.response_cache.max_entries,
			this.#config.response_cache.similarity_threshold,
		);
		this.#sessionStartTime = Date.now();
	}

	/** Whether TBM is enabled. */
	get enabled(): boolean {
		return this.#config.enabled;
	}

	/** Access subsystems directly. */
	get contextDelta(): ContextDeltaCache { return this.#contextDelta; }
	get pyramid(): ContextPyramid { return this.#pyramid; }
	get lazySkills(): LazySkillLoader { return this.#lazySkills; }
	get compressor(): ToolOutputCompressor { return this.#compressor; }
	get commMode(): CommunicationModeManager { return this.#commMode; }
	get tombstoner(): ConversationTombstoner { return this.#tombstoner; }
	get responseCache(): ResponseCache { return this.#responseCache; }
	get config(): Readonly<TbmConfig> { return this.#config; }

	/**
	 * Process a new user turn — main entry point for the session loop.
	 *
	 * 1. Check response cache
	 * 2. Resolve communication mode
	 * 3. Determine pyramid level
	 * 4. Process context delta
	 * 5. Load relevant skills (lazy)
	 */
	processTurn(message: string, fullContext: string): TurnResult {
		if (!this.#config.enabled) {
			return {
				content: fullContext,
				directive: "",
				pyramidLevel: 4 as PyramidLevel,
				tokensSavedThisTurn: 0,
				deltaCacheHit: false,
			};
		}

		let totalSaved = 0;

		// 1. Response cache check
		const cached = this.#responseCache.get(message);
		if (cached.hit && cached.response) {
			return {
				content: cached.response,
				directive: `[Cache ${cached.matchType} hit]`,
				pyramidLevel: this.#pyramid.level,
				tokensSavedThisTurn: estimateTokens(cached.response),
				deltaCacheHit: true,
			};
		}

		// 2. Communication mode
		const { directive } = this.#commMode.resolveForMessage(message);

		// 3. Pyramid level
		if (this.#config.pyramid.enabled) {
			const level = this.#pyramid.resolveLevel(message);
			this.#pyramid.setLevel(level);
		}

		// 4. Context delta
		let content = fullContext;
		let deltaCacheHit = false;
		if (this.#config.context_delta.enabled) {
			const delta = this.#contextDelta.processTurn(fullContext);
			content = delta.content;
			totalSaved += delta.tokensSaved;
			deltaCacheHit = !delta.staticChanged;
		}

		// 5. Lazy skills
		if (this.#config.lazy_skills.enabled) {
			const { skillsToLoad, indexSection } = this.#lazySkills.processMessage(
				message,
				this.#config.lazy_skills.max_per_turn,
			);
			if (skillsToLoad.length > 0) {
				content += "\n\n## Loaded Skills\n\n" + skillsToLoad.map((s) => s.fullContent).join("\n\n---\n\n");
			}
		}

		return {
			content,
			directive,
			pyramidLevel: this.#pyramid.level,
			tokensSavedThisTurn: totalSaved,
			deltaCacheHit,
		};
	}

	/**
	 * Compress tool output before adding to context.
	 */
	compressToolOutput(toolName: string, output: string): { output: string; compressed: boolean; tokensSaved: number } {
		if (!this.#config.compress.enabled) {
			return { output, compressed: false, tokensSaved: 0 };
		}
		return this.#compressor.compress(toolName, output);
	}

	/**
	 * Cache a response for future exact/semantic match.
	 */
	cacheResponse(query: string, response: string): void {
		if (this.#config.response_cache.enabled) {
			this.#responseCache.set(query, response);
		}
	}

	/**
	 * Tombstone old conversation messages.
	 */
	tombstoneMessages(messages: Array<{ role: "user" | "assistant"; content: string }>): {
		compressed: Array<{ role: "user" | "assistant"; content: string }>;
		tombstoned: number;
		tokensSaved: number;
	} {
		if (!this.#config.tombstone.enabled) {
			return { compressed: messages, tombstoned: 0, tokensSaved: 0 };
		}
		return this.#tombstoner.tombstone(messages);
	}

	/**
	 * Register skills for lazy loading.
	 */
	registerSkills(skills: SkillEntry[]): void {
		this.#lazySkills.registerSkills(skills);
	}

	/**
	 * Set communication mode explicitly.
	 */
	setMode(mode: CommMode | "auto"): void {
		this.#commMode.setMode(mode);
	}

	/**
	 * Build and render the token dashboard.
	 */
	getDashboard(): DashboardData {
		return buildDashboard(this, this.#sessionStartTime);
	}

	/**
	 * Render the dashboard as formatted text.
	 */
	renderDashboard(): string {
		return renderDashboard(this.getDashboard());
	}

	/**
	 * Render the dashboard as a compact one-liner.
	 */
	renderCompactDashboard(): string {
		return renderCompactDashboard(this.getDashboard());
	}

	/**
	 * Reset all subsystems (e.g. on session reset).
	 */
	reset(): void {
		this.#contextDelta.reset();
		this.#pyramid.reset();
		this.#lazySkills.reset();
		this.#compressor.reset();
		this.#commMode.reset();
		this.#tombstoner.reset();
		this.#responseCache.reset();
	}
}
