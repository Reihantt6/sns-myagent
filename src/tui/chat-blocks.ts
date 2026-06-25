/**
 * Chat message block renderers — bordered terminal blocks for each message role.
 * User, assistant, tool, system messages each get distinct visual treatment.
 * Inspired by Antigravity CLI / Pi / Hermes block-style rendering.
 */
import chalk from "chalk";
import gradient from "gradient-string";
import { visibleWidth } from "@oh-my-pi/pi-tui";

// ── Box-drawing chars (rounded) ──
const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeRight: "├",
  teeLeft: "┤",
} as const;

// ── Color themes per role ──
const ROLE_COLORS = {
  user: { border: chalk.cyan, label: chalk.cyan.bold, accent: "#00d2ff" },
  assistant: { border: chalk.magenta, label: chalk.magenta.bold, accent: "#7b2ff7" },
  tool: { border: chalk.yellow, label: chalk.yellow, accent: "#ffd700" },
  system: { border: chalk.dim, label: chalk.dim, accent: "#666666" },
  error: { border: chalk.red, label: chalk.red.bold, accent: "#ff4444" },
} as const;

export type MessageRole = keyof typeof ROLE_COLORS;

export interface ChatBlockOptions {
  role: MessageRole;
  label?: string;
  content: string;
  width?: number;
  meta?: string;
  streaming?: boolean;
}

/**
 * Word-wrap text respecting ANSI escape sequences.
 * Returns array of lines fitting within `maxWidth` visible columns.
 */
function wrapAnsi(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (visibleWidth(rawLine) <= maxWidth) {
      lines.push(rawLine);
      continue;
    }
    // Simple word-wrap
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

/**
 * Render a single chat message as a bordered block.
 */
export function renderChatBlock(opts: ChatBlockOptions): string {
  const cols = process.stdout.columns ?? 80;
  const width = Math.min(opts.width ?? cols, cols) - 2; // margin
  const colors = ROLE_COLORS[opts.role];
  const border = colors.border;

  const pad = 1;
  const innerWidth = width - 2 - pad * 2; // borders + padding

  const lines: string[] = [];

  // ── Top bar ──
  const label = opts.label ?? opts.role.toUpperCase();
  const labelText = ` ${label} `;
  const topFill = BOX.horizontal.repeat(
    Math.max(0, innerWidth - visibleWidth(labelText) + pad * 2)
  );
  lines.push(
    border(BOX.topLeft + BOX.horizontal.repeat(2)) +
      colors.label(labelText) +
      border(topFill + BOX.topRight)
  );

  // ── Content lines ──
  const contentLines = wrapAnsi(opts.content, innerWidth);
  const padStr = " ".repeat(pad);
  for (const line of contentLines) {
    const vis = visibleWidth(line);
    const fill = " ".repeat(Math.max(0, innerWidth - vis));
    lines.push(border(BOX.vertical) + padStr + line + fill + padStr + border(BOX.vertical));
  }

  // ── Meta line (timestamp, tokens, etc.) ──
  if (opts.meta) {
    const metaText = chalk.dim(opts.meta);
    const metaFill = " ".repeat(Math.max(0, innerWidth - visibleWidth(opts.meta)));
    lines.push(border(BOX.vertical) + padStr + metaText + metaFill + padStr + border(BOX.vertical));
  }

  // ── Streaming indicator ──
  if (opts.streaming) {
    const spinner = chalk.cyan("⣾") + chalk.dim(" thinking...");
    const spinFill = " ".repeat(Math.max(0, innerWidth - visibleWidth("⣾ thinking...")));
    lines.push(border(BOX.vertical) + padStr + spinner + spinFill + padStr + border(BOX.vertical));
  }

  // ── Bottom bar ──
  lines.push(
    border(BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight)
  );

  return lines.join("\n");
}

/**
 * Render a compact inline message (no box, just colored prefix).
 */
export function renderInline(role: MessageRole, text: string): string {
  const colors = ROLE_COLORS[role];
  const prefix = colors.label(`[${role}]`);
  return `${prefix} ${text}`;
}

/**
 * Render a separator/divider line.
 */
export function renderDivider(label?: string): string {
  const cols = process.stdout.columns ?? 80;
  const border = chalk.dim;
  if (!label) {
    return border("─".repeat(cols - 2));
  }
  const labelText = ` ${label} `;
  const fill = BOX.horizontal.repeat(Math.max(0, cols - 4 - visibleWidth(labelText)));
  return border(`${fill.slice(0, Math.floor(fill.length / 2))}`) +
    chalk.dim(labelText) +
    border(`${fill.slice(Math.floor(fill.length / 2))}`);
}

/**
 * Render a tool-call status block (compact, with spinner/done/error icon).
 */
export function renderToolBlock(
  toolName: string,
  status: "running" | "done" | "error",
  detail?: string,
): string {
  const cols = process.stdout.columns ?? 80;
  const width = Math.min(cols - 2, 72);
  const border = status === "error" ? chalk.red : status === "running" ? chalk.yellow : chalk.dim;

  const icon = status === "running" ? chalk.yellow("⚙") : status === "done" ? chalk.green("✓") : chalk.red("✗");
  const label = ` ${icon} tool:${toolName} `;
  const detailText = detail ? chalk.dim(` ${detail}`) : "";
  const fill = BOX.horizontal.repeat(
    Math.max(0, width - 2 - visibleWidth(` ⚙ tool:${toolName} `) - visibleWidth(detail ?? ""))
  );

  return border(BOX.topLeft + BOX.horizontal) + label + detailText + border(fill + BOX.topRight);
}

/**
 * Build a gradient header line for the top of the session.
 */
export function renderSessionHeader(model: string, version: string): string {
  const cols = process.stdout.columns ?? 80;
  const left = gradient(["#00d2ff", "#7b2ff7"])(" SnsCoder");
  const ver = chalk.dim(` v${version}`);
  const modelStr = chalk.cyan(` ${model}`);
  const sep = chalk.dim(" │ ");
  const line = `${left}${ver}${sep}${modelStr}`;
  const fill = chalk.dim("─".repeat(Math.max(0, cols - visibleWidth(line) - 2)));
  return `\n${line}\n${fill}\n`;
}
