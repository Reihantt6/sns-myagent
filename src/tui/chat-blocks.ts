/**
 * Chat message block renderers — single-accent bordered blocks.
 * One border style (rounded), one accent color (cyan). No role-specific
 * rainbow. Per-role distinction via bold label only.
 */
import chalk from "chalk";
import { visibleWidth } from "@oh-my-pi/pi-tui";

const BOX = {
	topLeft: "╭",
	topRight: "╮",
	bottomLeft: "╰",
	bottomRight: "╯",
	horizontal: "─",
	vertical: "│",
} as const;

const ACCENT = chalk.cyan;

export type MessageRole = "user" | "assistant" | "tool" | "system" | "error";

const ROLE_LABEL: Record<MessageRole, string> = {
	user: "you",
	assistant: "snsagent",
	tool: "tool",
	system: "system",
	error: "error",
};

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
	const width = Math.min(opts.width ?? cols, cols) - 2;
	const pad = 1;
	const innerWidth = width - 2 - pad * 2;

	const lines: string[] = [];

	// Top bar: accent line + label
	const label = opts.label ?? ROLE_LABEL[opts.role];
	const labelText = ` ${label} `;
	const topFill = BOX.horizontal.repeat(Math.max(0, innerWidth - visibleWidth(labelText) + pad * 2));
	lines.push(ACCENT(BOX.topLeft + BOX.horizontal.repeat(2)) + chalk.bold(labelText) + ACCENT(topFill + BOX.topRight));

	// Content
	const contentLines = wrapAnsi(opts.content, innerWidth);
	const padStr = " ".repeat(pad);
	for (const line of contentLines) {
		const vis = visibleWidth(line);
		const fill = " ".repeat(Math.max(0, innerWidth - vis));
		lines.push(ACCENT(BOX.vertical) + padStr + line + fill + padStr + ACCENT(BOX.vertical));
	}

	// Meta
	if (opts.meta) {
		const metaText = chalk.dim(opts.meta);
		const metaFill = " ".repeat(Math.max(0, innerWidth - visibleWidth(opts.meta)));
		lines.push(ACCENT(BOX.vertical) + padStr + metaText + metaFill + padStr + ACCENT(BOX.vertical));
	}

	// Streaming
	if (opts.streaming) {
		const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
		const frameIdx = Date.now() % (frames.length * 80);
		const frame = frames[Math.floor(frameIdx / 80)];
		const spinnerText = `${ACCENT(frame)} ${chalk.dim("thinking...")}`;
		const spinFill = " ".repeat(Math.max(0, innerWidth - visibleWidth(spinnerText)));
		lines.push(ACCENT(BOX.vertical) + padStr + spinnerText + spinFill + padStr + ACCENT(BOX.vertical));
	}

	// Bottom bar
	lines.push(ACCENT(BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight));

	return lines.join("\n");
}

/** Compact inline message — no box. */
export function renderInline(role: MessageRole, text: string): string {
	const label = chalk.bold(`[${ROLE_LABEL[role]}]`);
	return `${label} ${text}`;
}

/** Separator line, optional label. */
export function renderDivider(label?: string): string {
	const cols = process.stdout.columns ?? 80;
	if (!label) {
		return chalk.dim("─".repeat(cols - 2));
	}
	const labelText = ` ${label} `;
	const fill = "─".repeat(Math.max(0, cols - 2 - visibleWidth(labelText)));
	return chalk.dim(fill.slice(0, Math.floor(fill.length / 2))) + chalk.dim(labelText) + chalk.dim(fill.slice(Math.floor(fill.length / 2)));
}

/** Tool-call status line. */
export function renderToolBlock(
	toolName: string,
	status: "running" | "done" | "error",
	detail?: string,
): string {
	const icon = status === "running" ? chalk.cyan("⚙") : status === "done" ? chalk.green("✓") : chalk.red("✗");
	const label = ` ${icon} tool:${toolName} `;
	const detailText = detail ? chalk.dim(` ${detail}`) : "";
	return label + detailText;
}

/** Session header. */
export function renderSessionHeader(model: string, version: string): string {
	const cols = process.stdout.columns ?? 80;
	const left = ACCENT.bold(" snsagent");
	const ver = chalk.dim(` v${version}`);
	const modelStr = chalk.dim(" · ") + chalk.cyan(model);
	const sep = chalk.dim("─".repeat(Math.max(0, cols - visibleWidth(left + ver + modelStr) - 2)));
	return `\n${left}${ver}${modelStr}\n${sep}\n`;
}
