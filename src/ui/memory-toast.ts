/**
 * Memory toast notification component for SNS-MyAgent terminal UI.
 *
 * Shows brief, non-intrusive memory recall/save notifications.
 * Auto-dismiss style — fades after a short duration.
 */
import chalk from "chalk";
import gradient from "gradient-string";
import { BRAND_GRADIENT } from "./colors.js";

export type ToastType = "recall" | "save" | "forget" | "info";

export interface MemoryToastOptions {
  /** Type of memory operation. */
  type: ToastType;
  /** Short description of what happened. */
  message: string;
  /** Memory ID (optional, shown as dim). */
  memoryId?: string;
  /** Relevance score (0-1). */
  relevance?: number;
  /** Duration in ms before auto-dismiss (default: 3000). */
  duration?: number;
}

const TOAST_CONFIG = {
  recall: { icon: "🧠", label: "MEMORY", gradient: ["#00d2ff", "#7b2ff7"] as [string, string] },
  save: { icon: "💾", label: "SAVED", gradient: ["#00ff88", "#00d2ff"] as [string, string] },
  forget: { icon: "🗑", label: "FORGOT", gradient: ["#ff8c00", "#ff4444"] as [string, string] },
  info: { icon: "ℹ", label: "INFO", gradient: ["#7b2ff7", "#ff6b9d"] as [string, string] },
} as const;

/**
 * Render a memory toast notification line.
 * Returns a string that can be printed and then cleared.
 */
export function renderMemoryToast(opts: MemoryToastOptions): string {
  const config = TOAST_CONFIG[opts.type];
  const grad = gradient(config.gradient);

  const icon = config.icon;
  const label = grad(chalk.bold(` ${config.label} `));
  const msg = chalk.white(opts.message);

  const parts = [icon, label, msg];

  if (opts.memoryId) {
    parts.push(chalk.dim(`#${opts.memoryId.slice(0, 8)}`));
  }

  if (opts.relevance !== undefined) {
    const score = Math.round(opts.relevance * 100);
    const scoreColor = score > 80 ? chalk.green : score > 50 ? chalk.yellow : chalk.dim;
    parts.push(scoreColor(`(${score}%)`));
  }

  return `  ${parts.join(" ")}`;
}

/**
 * Render a memory recall toast with context snippet.
 */
export function renderMemoryRecall(
  query: string,
  snippet: string,
  relevance?: number,
): string {
  const grad = gradient(BRAND_GRADIENT);
  const icon = "🧠";
  const label = grad(chalk.bold(" MEMORY "));
  const queryStr = chalk.cyan(`"${query}"`);
  const scoreStr = relevance !== undefined
    ? chalk.dim(` ${Math.round(relevance * 100)}% match`)
    : "";

  const lines = [
    `${icon} ${label} ${queryStr}${scoreStr}`,
    `  ${chalk.dim(snippet.slice(0, 120))}${snippet.length > 120 ? chalk.dim("...") : ""}`,
  ];

  return lines.join("\n");
}

/**
 * Render a memory save confirmation toast.
 */
export function renderMemorySave(content: string, scope?: string): string {
  const grad = gradient(["#00ff88", "#00d2ff"]);
  const icon = "💾";
  const label = grad(chalk.bold(" SAVED "));
  const scopeStr = scope ? chalk.dim(` [${scope}]`) : "";
  const preview = content.length > 80 ? content.slice(0, 80) + "..." : content;

  return `${icon} ${label}${scopeStr} ${chalk.dim(preview)}`;
}

/**
 * Clear toast line (ANSI escape to clear current line).
 */
export function clearToastLine(): void {
  process.stdout.write("\x1b[2K\r");
}
