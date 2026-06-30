/**
 * Memory toast — brief non-intrusive recall/save notifications.
 * Single accent (cyan), no gradient, no per-type color explosion.
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

const TOAST_ICON: Record<ToastType, string> = {
	recall: "·",
	save: "+",
	forget: "-",
	info: "i",
};

export function renderMemoryToast(opts: MemoryToastOptions): string {
	const icon = TOAST_ICON[opts.type];
	const label = chalk.cyan.bold(` ${TOAST_LABEL[opts.type]} `);
	const msg = opts.message;

	const parts = [chalk.dim(icon), label, msg];

	if (opts.memoryId) {
		parts.push(chalk.dim(`#${opts.memoryId.slice(0, 8)}`));
	}

	if (opts.relevance !== undefined) {
		const score = Math.round(opts.relevance * 100);
		const scoreColor = score > 80 ? chalk.cyan : chalk.dim;
		parts.push(scoreColor(`(${score}%)`));
	}

	return `  ${parts.join(" ")}`;
}

export function renderMemoryRecall(query: string, snippet: string, relevance?: number): string {
	const queryStr = chalk.cyan(`"${query}"`);
	const scoreStr = relevance !== undefined
		? chalk.dim(` ${Math.round(relevance * 100)}% match`)
		: "";

	const lines = [
		`${chalk.dim("·")} ${chalk.cyan.bold(" memory ")} ${queryStr}${scoreStr}`,
		`  ${chalk.dim(snippet.slice(0, 120))}${snippet.length > 120 ? chalk.dim("...") : ""}`,
	];

	return lines.join("\n");
}

export function renderMemorySave(content: string, scope?: string): string {
	const label = chalk.cyan.bold(" saved ");
	const scopeStr = scope ? chalk.dim(` [${scope}]`) : "";
	const preview = content.length > 80 ? content.slice(0, 80) + "..." : content;

	return `${chalk.dim("+")} ${label}${scopeStr} ${chalk.dim(preview)}`;
}

export function clearToastLine(): void {
	process.stdout.write("\x1b[2K\r");
}
