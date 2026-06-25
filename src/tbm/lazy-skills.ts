/**
 * Lazy Skill Loading — inject skill names only, load full content on-demand.
 *
 * Instead of loading all skills into context (~50,000+ tokens),
 * inject only skill names (~200 tokens) and load full content
 * when the model explicitly references a skill.
 *
 * Target: ~700 tokens vs 50,000+ if all loaded.
 */

export interface SkillEntry {
	/** Skill name (kebab-case). */
	name: string;
	/** Short description for name-only injection. */
	description: string;
	/** Full content — only loaded on-demand. */
	fullContent: string;
	/** Approximate token count of full content. */
	tokens: number;
	/** Category for grouping. */
	category?: string;
}

export interface LazySkillStats {
	/** Total skills available. */
	totalAvailable: number;
	/** Skills injected as names only. */
	namesInjected: number;
	/** Skills fully loaded this session. */
	loadedOnDemand: number;
	/** Tokens saved by not loading all skills. */
	tokensSaved: number;
	/** Names injection token cost. */
	nameTokens: number;
}

/**
 * Build a compact skill-name-only prompt section.
 * Format: "- skill-name: short description"
 * Stays within the name_budget token limit.
 */
export function buildSkillNameIndex(skills: SkillEntry[], nameBudget: number): string {
	let tokens = 0;
	const lines: string[] = ["## Available Skills (load on-demand with skill name)"];

	for (const skill of skills) {
		const line = `- **${skill.name}**: ${skill.description}`;
		const lineTokens = Math.ceil(line.length / 4);

		if (tokens + lineTokens > nameBudget) {
			lines.push(`- ...and ${skills.length - lines.length + 1} more`);
			break;
		}

		lines.push(line);
		tokens += lineTokens;
	}

	return lines.join("\n");
}

/**
 * Detect which skill names are referenced in a message.
 * Returns names of skills that should be fully loaded.
 */
export function detectSkillReferences(message: string, availableSkills: SkillEntry[]): string[] {
	const lower = message.toLowerCase();
	const referenced: string[] = [];

	for (const skill of availableSkills) {
		// Direct name mention
		if (lower.includes(skill.name)) {
			referenced.push(skill.name);
			continue;
		}

		// Description keyword match (at least 2 significant words)
		const descWords = skill.description
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 4);
		const matchCount = descWords.filter((w) => lower.includes(w)).length;
		if (matchCount >= 2) {
			referenced.push(skill.name);
		}
	}

	return referenced;
}

export class LazySkillLoader {
	#skills: SkillEntry[] = [];
	#loadedThisSession: Set<string> = new Set();
	#stats: LazySkillStats = {
		totalAvailable: 0,
		namesInjected: 0,
		loadedOnDemand: 0,
		tokensSaved: 0,
		nameTokens: 0,
	};

	/**
	 * Register available skills (called once at session start).
	 */
	registerSkills(skills: SkillEntry[]): void {
		this.#skills = skills;
		this.#stats.totalAvailable = skills.length;
	}

	/**
	 * Get the compact skill name index for prompt injection.
	 * Returns the name-only section (~200 tokens).
	 */
	getNameIndex(nameBudget: number = 200): string {
		const index = buildSkillNameIndex(this.#skills, nameBudget);
		this.#stats.namesInjected = Math.min(this.#skills.length, this.#countLines(index));
		this.#stats.nameTokens = Math.ceil(index.length / 4);
		return index;
	}

	/**
	 * Process a user message — detect skill references and return
	 * full content for skills that should be loaded.
	 */
	processMessage(message: string, maxPerTurn: number = 3): {
		skillsToLoad: SkillEntry[];
		indexSection: string;
	} {
		const refs = detectSkillReferences(message, this.#skills);
		const newRefs = refs.filter((r) => !this.#loadedThisSession.has(r));

		// Limit per-turn loading
		const toLoad = newRefs.slice(0, maxPerTurn);
		const skillsToLoad: SkillEntry[] = [];

		for (const name of toLoad) {
			const skill = this.#skills.find((s) => s.name === name);
			if (skill) {
				skillsToLoad.push(skill);
				this.#loadedThisSession.add(name);
				this.#stats.loadedOnDemand++;
				this.#stats.tokensSaved += skill.tokens - Math.ceil(skill.name.length / 4);
			}
		}

		return {
			skillsToLoad,
			indexSection: this.getNameIndex(),
		};
	}

	/** Get stats snapshot. */
	get stats(): Readonly<LazySkillStats> {
		return { ...this.#stats };
	}

	/** Get number of skills currently loaded in full. */
	get loadedCount(): number {
		return this.#loadedThisSession.size;
	}

	/** Check if a skill is already loaded. */
	isLoaded(name: string): boolean {
		return this.#loadedThisSession.has(name);
	}

	/** Reset loader state. */
	reset(): void {
		this.#loadedThisSession.clear();
		this.#stats = {
			totalAvailable: this.#skills.length,
			namesInjected: 0,
			loadedOnDemand: 0,
			tokensSaved: 0,
			nameTokens: 0,
		};
	}

	#countLines(text: string): number {
		return text.split("\n").filter((l) => l.startsWith("- **")).length;
	}
}
