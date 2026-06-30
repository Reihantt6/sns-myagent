/**
 * Chat blocks — flat `●` prefix style.
 * No rounded boxes, no per-role color. One accent (cyan) for the bullet.
 * Role distinction via the bullet label only.
 */
import chalk from "chalk";
import { visibleWidth } from "@oh-my-pi/pi-tui";

export type MessageRole = "user" | "assistant" | "tool" | "system" | "error";

const ROLE_LABEL: Record<MessageRole, string> = {
	user: "you",
	assistant: "snsagent",
	tool: "tool",
	system: "system",
	error: "error",
};

const BULLET = chalk.cyan("●");

export interface ChatBlockOptions {
	role: MessageRole;
	label?: string;
	content: string;
	width?: number;
	meta?: string;
	streaming?: boolean;
}

function wrapAnsi(text: string, maxWidth: number): string[] {
	const lines: string[] = [];
	for (const rawLine of text.split("\n")) {
		if (visibleWidth(rawLine) <= maxWidth) {
			lines.push(rawLine);
			continue;
		}
		let current = "";
		let currentWidth = 0;
		const words = rawLine.split(/(\s+)/);
		for (const word of words) {
			const wWidth = visibleWidth(word);
			if (currentWidth + wWidth > maxWidth && current.length > 0) {
				lines.push(current);
				current = word.trimStart();
				currentWidth = visibleWidth(current);
			} else {
				current += word;
				currentWidth += wWidth;
			}
		}
		if (current.length > 0) lines.push(current);
	}
	return lines;
}

export function renderChatBlock(opts: ChatBlockOptions): string {
	const cols = process.stdout.columns ?? 80;
	const width = opts.width ?? Math.min(cols - 4, 80);
	const innerWidth = width - 6; // "  ● label  "

	const label = opts.label ?? ROLE_LABEL[opts.role];
	const headerRight = opts.meta ? chalk.dim(opts.meta) : "";

	// Header: `● label                     meta`
	const headerFillLen = Math.max(0, innerWidth - visibleWidth(label) - visibleWidth(headerRight));
	const headerFill = " ".repeat(headerFillLen);
	const header = `  ${BULLET} ${chalk.bold(label)}${headerFill}${headerRight ? "  " + headerRight : ""}`;

	// Content: indent continuation lines with `│` for visual grouping
	const contentLines = wrapAnsi(opts.content, innerWidth);
	const indented = contentLines.map((l) => `  ${chalk.dim("│")} ${l}`);

	const parts: string[] = [header, ...indented];

	if (opts.streaming) {
		parts.push(`  ${chalk.dim("│")} ${chalk.cyan("…")} ${chalk.dim("thinking")}`);
	}

	return parts.join("\n");
}

/** Compact inline message — no box. */
export function renderInline(role: MessageRole, text: string): string {
	return `${BULLET} ${chalk.bold(ROLE_LABEL[role])}  ${text}`;
}

/** Separator line — single dim rule. */
export function renderDivider(label?: string): string {
	const cols = process.stdout.columns ?? 80;
	if (!label) return chalk.dim("─".repeat(cols - 2));
	const labelText = ` ${label} `;
	const fill = "─".repeat(Math.max(0, cols - 2 - visibleWidth(labelText)));
	return chalk.dim(fill) + chalk.dim(labelText) + chalk.dim(fill);
}

/** Tool-call status line. */
export function renderToolBlock(
	toolName: string,
	status: "running" | "done" | "error",
	detail?: string,
): string {
	const icon = status === "running" ? chalk.cyan("●") : status === "done" ? chalk.green("●") : chalk.red("●");
	const label = ` ${icon} tool:${toolName} `;
	const detailText = detail ? chalk.dim(` ${detail}`) : "";
	return label + detailText;
}

/** Session header — single line. */
export function renderSessionHeader(model: string, version: string): string {
	return `  ${chalk.cyan.bold("MY")}  ${chalk.bold("snsagent")} ${chalk.dim(`v${version}`)}  ${chalk.dim("·")}  ${chalk.cyan(model)}\n`;
}
