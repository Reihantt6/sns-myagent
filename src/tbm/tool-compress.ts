/**
 * Tool Output Auto-Compress — truncate/summarize tool output to fit budgets.
 *
 * Each tool type has a token budget. Output exceeding the budget is compressed.
 *
 * | Tool | Max Budget | Strategy |
 * |------|-----------|----------|
 * | terminal | 500 tokens | Truncate + strip ANSI |
 * | read_file | 800 tokens | Only relevant lines |
 * | web_extract | 1,000 tokens | Summarize key content |
 * | search_files | 300 tokens | Top N results only |
 */

import type { TbmConfig } from "./config";
import { estimateTokens } from "./context-delta";

export interface CompressStats {
	/** Total tool outputs processed. */
	totalOutputs: number;
	/** Outputs that needed compression. */
	compressed: number;
	/** Tokens saved by compression. */
	tokensSaved: number;
	/** Per-tool compression counts. */
	perTool: Record<string, { compressed: number; tokensSaved: number }>;
}

/** Strip ANSI escape codes from text. */
function stripAnsi(text: string): string {
	return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1B\][^\x07]*\x07/g, "");
}

/** Strip duplicate blank lines (3+ → 2). */
function collapseBlankLines(text: string): string {
	return text.replace(/\n{3,}/g, "\n\n");
}

/** Truncate text to fit within token budget, preserving start and end. */
function truncateToBudget(text: string, maxTokens: number): { text: string; truncated: boolean } {
	const currentTokens = estimateTokens(text);
	if (currentTokens <= maxTokens) return { text, truncated: false };

	// Keep 70% from start, 30% from end
	const charBudget = maxTokens * 4;
	const startChars = Math.floor(charBudget * 0.7);
	const endChars = charBudget - startChars;

	const start = text.slice(0, startChars);
	const end = text.slice(-endChars);

	return {
		text: `${start}\n\n[... ${currentTokens - maxTokens} tokens compressed ...]\n\n${end}`,
		truncated: true,
	};
}

/** Extract top N search results from search_files output. */
function topNResults(text: string, maxTokens: number): { text: string; truncated: boolean } {
	const lines = text.split("\n");
	const resultLines: string[] = [];
	let tokens = 0;

	for (const line of lines) {
		const lineTokens = estimateTokens(line);
		if (tokens + lineTokens > maxTokens) break;
		resultLines.push(line);
		tokens += lineTokens;
	}

	if (resultLines.length === lines.length) return { text, truncated: false };

	return {
		text: resultLines.join("\n") + `\n\n[... ${lines.length - resultLines.length} more results truncated ...]`,
		truncated: true,
	};
}

/** Compress terminal output: strip ANSI, collapse blanks, truncate. */
function compressTerminal(text: string, maxTokens: number): { text: string; tokensSaved: number } {
	let processed = stripAnsi(text);
	processed = collapseBlankLines(processed);

	const originalTokens = estimateTokens(text);
	const result = truncateToBudget(processed, maxTokens);

	return {
		text: result.text,
		tokensSaved: Math.max(0, originalTokens - estimateTokens(result.text)),
	};
}

/** Compress file output: keep relevant lines around the middle. */
function compressFileOutput(text: string, maxTokens: number): { text: string; tokensSaved: number } {
	const originalTokens = estimateTokens(text);
	const result = truncateToBudget(text, maxTokens);

	return {
		text: result.text,
		tokensSaved: Math.max(0, originalTokens - estimateTokens(result.text)),
	};
}

/** Compress web extract: keep first and last portions. */
function compressWebExtract(text: string, maxTokens: number): { text: string; tokensSaved: number } {
	const originalTokens = estimateTokens(text);

	// Remove markdown formatting bloat
	let processed = text
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\s*[-*]\s*$/gm, ""); // remove empty list items

	const result = truncateToBudget(processed, maxTokens);

	return {
		text: result.text,
		tokensSaved: Math.max(0, originalTokens - estimateTokens(result.text)),
	};
}

/** Compress search output: keep top results. */
function compressSearch(text: string, maxTokens: number): { text: string; tokensSaved: number } {
	const originalTokens = estimateTokens(text);
	const result = topNResults(text, maxTokens);

	return {
		text: result.text,
		tokensSaved: Math.max(0, originalTokens - estimateTokens(result.text)),
	};
}

export class ToolOutputCompressor {
	#budgets: TbmConfig["compress"]["budgets"];
	#stats: CompressStats = {
		totalOutputs: 0,
		compressed: 0,
		tokensSaved: 0,
		perTool: {},
	};

	constructor(budgets: TbmConfig["compress"]["budgets"]) {
		this.#budgets = budgets;
	}

	/**
	 * Compress tool output to fit within its budget.
	 * Returns the (possibly compressed) output and stats.
	 */
	compress(toolName: string, output: string): { output: string; compressed: boolean; tokensSaved: number } {
		this.#stats.totalOutputs++;

		const budget = this.#getBudget(toolName);
		const currentTokens = estimateTokens(output);

		if (currentTokens <= budget) {
			return { output, compressed: false, tokensSaved: 0 };
		}

		let result: { text: string; tokensSaved: number };

		switch (toolName) {
			case "terminal":
			case "execute_command":
				result = compressTerminal(output, budget);
				break;
			case "read_file":
			case "readFile":
				result = compressFileOutput(output, budget);
				break;
			case "web_extract":
			case "webExtract":
				result = compressWebExtract(output, budget);
				break;
			case "search_files":
			case "searchFiles":
			case "grep":
				result = compressSearch(output, budget);
				break;
			default:
				result = { text: truncateToBudget(output, budget).text, tokensSaved: Math.max(0, currentTokens - budget) };
		}

		this.#stats.compressed++;
		this.#stats.tokensSaved += result.tokensSaved;

		if (!this.#stats.perTool[toolName]) {
			this.#stats.perTool[toolName] = { compressed: 0, tokensSaved: 0 };
		}
		this.#stats.perTool[toolName].compressed++;
		this.#stats.perTool[toolName].tokensSaved += result.tokensSaved;

		return { output: result.text, compressed: true, tokensSaved: result.tokensSaved };
	}

	/** Get stats snapshot. */
	get stats(): Readonly<CompressStats> {
		return { ...this.#stats };
	}

	/** Get compression ratio (compressed / total). */
	get compressionRatio(): number {
		if (this.#stats.totalOutputs === 0) return 0;
		return this.#stats.compressed / this.#stats.totalOutputs;
	}

	#getBudget(toolName: string): number {
		const budgets = this.#budgets;
		switch (toolName) {
			case "terminal":
			case "execute_command":
				return budgets.terminal;
			case "read_file":
			case "readFile":
				return budgets.read_file;
			case "web_extract":
			case "webExtract":
				return budgets.web_extract;
			case "search_files":
			case "searchFiles":
			case "grep":
				return budgets.search_files;
			default:
				return budgets.default;
		}
	}

	/** Reset stats. */
	reset(): void {
		this.#stats = { totalOutputs: 0, compressed: 0, tokensSaved: 0, perTool: {} };
	}
}
