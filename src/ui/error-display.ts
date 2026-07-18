/**
 * Error display — flat `●` prefix, severity icon.
 * No box, no gradient, no nested borders. Just one line per item.
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
			return { icon: chalk.red("●"), label: "ERROR" };
		case "warning":
			return { icon: chalk.yellow("●"), label: "WARNING" };
		case "info":
			return { icon: chalk.hex("#F97316")("●"), label: "INFO" };
	}
}

export function renderErrorDisplay(opts: ErrorDisplayOptions): string {
	const severity = opts.severity ?? "error";
	const meta = getSeverityMeta(severity);
	const codeStr = opts.code ? chalk.dim(`  [${opts.code}]`) : "";

	const lines: string[] = [];

	// Header
	lines.push(`  ${meta.icon} ${chalk.bold(meta.label)}${codeStr}`);

	// Title
	lines.push(`    ${chalk.bold(opts.title)}`);

	// Message
	for (const line of opts.message.split("\n")) {
		lines.push(`    ${line}`);
	}

	// Context
	if (opts.context && opts.context.length > 0) {
		lines.push("");
		lines.push(`    ${chalk.dim("context:")}`);
		for (const ctx of opts.context.slice(0, 5)) {
			lines.push(`      ${chalk.dim(ctx)}`);
		}
		if (opts.context.length > 5) {
			lines.push(`      ${chalk.dim(`... +${opts.context.length - 5} more`)}`);
		}
	}

	// Suggestion
	if (opts.suggestion) {
		lines.push("");
		lines.push(`    ${chalk.hex("#F97316")("→")} ${chalk.bold("suggestion:")}`);
		lines.push(`      ${opts.suggestion}`);
	}

	// Stack preview
	if (opts.stack) {
		lines.push("");
		const stackLines = opts.stack.split("\n").slice(0, 3);
		lines.push(`    ${chalk.dim("stack (first 3):")}`);
		for (const sl of stackLines) {
			lines.push(`      ${chalk.dim(sl.trim())}`);
		}
	}

	return lines.join("\n");
}

export function renderQuickError(title: string, message: string): string {
	return renderErrorDisplay({ title, message, severity: "error" });
}

export function renderWarning(title: string, message: string, suggestion?: string): string {
	return renderErrorDisplay({ title, message, severity: "warning", suggestion });
}
