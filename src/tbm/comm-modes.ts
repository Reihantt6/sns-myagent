/**
 * Communication Modes — controls response verbosity.
 *
 * | Mode | Example | Tokens | Use Case |
 * |------|---------|--------|----------|
 * | Caveman | `Bug auth. Fix: token_exp < not <=.` | ~20 | Debug, quick ops |
 * | Normal | `Found bug in auth middleware. Token expiry check uses wrong operator.` | ~60 | Daily work |
 * | Verbose | Full explanation with context and alternatives... | ~150 | Learning, docs |
 */

export type CommMode = "caveman" | "normal" | "verbose";

export interface CommModeConfig {
	/** Mode label. */
	name: CommMode;
	/** Approximate target tokens per response. */
	targetTokens: number;
	/** System prompt addition to guide response style. */
	systemDirective: string;
	/** Human-readable description. */
	description: string;
}

/** Mode definitions. */
export const COMM_MODES: ReadonlyMap<CommMode, CommModeConfig> = new Map([
	[
		"caveman",
		{
			name: "caveman",
			targetTokens: 20,
			description: "Ultra-terse. Fragments only. No filler. Tech terms exact.",
			systemDirective: `Respond in caveman style:
- Drop articles (a/an/the), filler words, pleasantries
- Fragments OK. Short synonyms only
- Pattern: [thing] [action] [reason]
- Code blocks, paths, commands, errors: keep exact
- Security warnings: write normal, resume terse after
- Example: "Bug in auth middleware. Token expiry check uses < not <=. Fix:"`,
		},
	],
	[
		"normal",
		{
			name: "normal",
			targetTokens: 60,
			description: "Clear and concise. Standard professional tone.",
			systemDirective: `Respond clearly and concisely:
- Complete sentences but no filler
- Be direct — state the finding/answer first, then brief context if needed
- Code blocks, paths, errors: keep exact
- No pleasantries or hedging`,
		},
	],
	[
		"verbose",
		{
			name: "verbose",
			targetTokens: 150,
			description: "Full explanation with context, alternatives, and reasoning.",
			systemDirective: `Respond with full detail:
- Explain the "why" behind every recommendation
- Include alternatives and trade-offs
- Provide examples where helpful
- Structure with headers/lists for readability
- Good for learning, documentation, complex decisions`,
		},
	],
]);

/**
 * Auto-detect communication mode from message characteristics.
 */
export function autoDetectMode(message: string): CommMode {
	const lower = message.toLowerCase();
	const len = message.length;

	// Caveman triggers: very short, command-like, debug context
	if (len < 30) return "caveman";
	if (len < 80 && !lower.includes("explain") && !lower.includes("why") && !lower.includes("how")) {
		return "caveman";
	}

	// Verbose triggers: learning/doc context
	const verboseKeywords = ["explain", "why", "how does", "teach", "learn", "documentation", "comprehensive", "detailed", "trade-off"];
	if (verboseKeywords.some((kw) => lower.includes(kw))) return "verbose";

	// Default: normal
	return "normal";
}

export class CommunicationModeManager {
	#currentMode: CommMode | "auto";
	#effectiveMode: CommMode;
	#usage: Map<CommMode, number> = new Map([
		["caveman", 0],
		["normal", 0],
		["verbose", 0],
	]);

	constructor(initialMode: CommMode | "auto" = "auto") {
		this.#currentMode = initialMode;
		this.#effectiveMode = initialMode === "auto" ? "normal" : initialMode;
	}

	/** Get the current mode setting (may be "auto"). */
	get setting(): CommMode | "auto" {
		return this.#currentMode;
	}

	/** Get the effective mode (never "auto" — resolved to concrete mode). */
	get effective(): CommMode {
		return this.#effectiveMode;
	}

	/** Get the system directive for the current effective mode. */
	get directive(): string {
		return COMM_MODES.get(this.#effectiveMode)?.systemDirective ?? "";
	}

	/** Get the target token count for the current effective mode. */
	get targetTokens(): number {
		return COMM_MODES.get(this.#effectiveMode)?.targetTokens ?? 60;
	}

	/**
	 * Resolve the mode for a new message.
	 * If mode is "auto", detects from message content.
	 * Returns the directive to inject into system prompt.
	 */
	resolveForMessage(message: string): { mode: CommMode; directive: string } {
		if (this.#currentMode === "auto") {
			this.#effectiveMode = autoDetectMode(message);
		}

		this.#usage.set(this.#effectiveMode, (this.#usage.get(this.#effectiveMode) ?? 0) + 1);

		return {
			mode: this.#effectiveMode,
			directive: this.directive,
		};
	}

	/** Set mode explicitly (from /mode command). */
	setMode(mode: CommMode | "auto"): void {
		this.#currentMode = mode;
		if (mode !== "auto") {
			this.#effectiveMode = mode;
		}
	}

	/** Get usage stats. */
	get usage(): ReadonlyMap<CommMode, number> {
		return this.#usage;
	}

	/** Reset state. */
	reset(): void {
		this.#effectiveMode = this.#currentMode === "auto" ? "normal" : this.#currentMode;
		this.#usage = new Map([
			["caveman", 0],
			["normal", 0],
			["verbose", 0],
		]);
	}
}
