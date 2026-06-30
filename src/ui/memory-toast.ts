/**
 * Memory toast — flat `●` prefix, single accent.
 */

import chalk from "chalk";

export type ToastType = "recall" | "save" | "forget" | "info";

export interface MemoryToastOptions {
	type: ToastType;
	message: string;
	memoryId?: string;
	relevance?: number;
	duration?: number;
}

const TOAST_LABEL: Record<ToastType, string> = {
	recall: "memory",
	save: "saved",
	forget: "forgot",
	info: "info",
};

export function renderMemoryToast(opts: MemoryToastOptions): string {
	const label = chalk.cyan(`● ${TOAST_LABEL[opts.type]}`);
	const msg = opts.message;
	const parts = [label, msg];

	if (opts.memoryId) {
		parts.push(chalk.dim(`#${opts.memoryId.slice(0, 8)}`));
	}

	if (opts.relevance !== undefined) {
		const score = Math.round(opts.relevance * 100);
		parts.push(chalk.cyan(`(${score}%)`));
	}

	return `  ${parts.join("  ")}`;
}

export function renderMemoryRecall(query: string, snippet: string, relevance?: number): string {
	const queryStr = chalk.cyan(`"${query}"`);
	const scoreStr = relevance !== undefined
		? chalk.dim(`  ${Math.round(relevance * 100)}% match`)
		: "";

	const lines = [
		`  ${chalk.cyan("● memory")}  ${queryStr}${scoreStr}`,
		`    ${chalk.dim(snippet.slice(0, 120))}${snippet.length > 120 ? chalk.dim("...") : ""}`,
	];

	return lines.join("\n");
}

export function renderMemorySave(content: string, scope?: string): string {
	const scopeStr = scope ? chalk.dim(`  [${scope}]`) : "";
	const preview = content.length > 80 ? content.slice(0, 80) + "..." : content;
	return `  ${chalk.cyan("● saved")}${scopeStr}  ${chalk.dim(preview)}`;
}

export function clearToastLine(): void {
	process.stdout.write("\x1b[2K\r");
}
