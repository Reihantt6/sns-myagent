/**
 * Error display — minimal, single accent, no gradient.
 * Severity controls the icon color (red/yellow/cyan) but everything else
 * stays dim + default text.
 */

import chalk from "chalk";

export type ErrorSeverity = "error" | "warning" | "info";

export interface ErrorDisplayOptions {
	title: string;
	message: string;
	code?: string;
	severity?: ErrorSeverity;
	stack?: string;
	suggestion?: string;
	context?: string[];
}

function getSeverityMeta(severity: ErrorSeverity) {
	switch (severity) {
		case "error":
			return { icon: "✗", label: "ERROR", color: chalk.red.bold };
		case "warning":
			return { icon: "⚠", label: "WARNING", color: chalk.yellow.bold };
		case "info":
			return { icon: "ℹ", label: "INFO", color: chalk.cyan.bold };
	}
}

export function renderErrorDisplay(opts: ErrorDisplayOptions): string {
	const severity = opts.severity ?? "error";
	const meta = getSeverityMeta(severity);
	const cols = process.stdout.columns ?? 80;
	const width = Math.min(cols - 2, 72);

	const border = "─".repeat(width - 2);

	const lines: string[] = [];
	lines.push(chalk.dim(border));

	// Header
	const codeStr = opts.code ? chalk.dim(` [${opts.code}]`) : "";
	lines.push(`${meta.color(meta.icon)} ${meta.color(meta.label)}${codeStr}`);
	lines.push("");
	lines.push(chalk.bold(opts.title));
	lines.push("");

	// Message
	for (const line of opts.message.split("\n")) {
		lines.push(line);
	}

	// Context
	if (opts.context && opts.context.length > 0) {
		lines.push("");
		lines.push(chalk.dim("Context:"));
		for (const ctx of opts.context.slice(0, 5)) {
			lines.push(chalk.dim(`  ${ctx}`));
		}
		if (opts.context.length > 5) {
			lines.push(chalk.dim(`  ... +${opts.context.length - 5} more`));
		}
	}

	// Suggestion
	if (opts.suggestion) {
		lines.push("");
		lines.push(`${chalk.cyan("→")} ${chalk.bold("Suggestion:")}`);
		lines.push(`  ${opts.suggestion}`);
	}

	// Stack preview
	if (opts.stack) {
		lines.push("");
		const stackLines = opts.stack.split("\n").slice(0, 3);
		lines.push(chalk.dim("Stack (first 3):"));
		for (const sl of stackLines) {
			lines.push(chalk.dim(`  ${sl.trim()}`));
		}
	}

	lines.push(chalk.dim(border));
	return lines.join("\n");
}

export function renderQuickError(title: string, message: string): string {
	return renderErrorDisplay({ title, message, severity: "error" });
}

export function renderWarning(title: string, message: string, suggestion?: string): string {
	return renderErrorDisplay({ title, message, severity: "warning", suggestion });
}
