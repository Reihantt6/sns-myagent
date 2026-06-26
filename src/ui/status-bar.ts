/**
 * Status bar for SNS-MyAgent terminal UI.
 *
 * Renders a bottom-line summary: model, tokens, session time, memory hits.
 * Uses ANSI to draw a single-line bar at the bottom of the terminal.
 * Premium gradient styling.
 */

import chalk from "chalk";
import gradient from "gradient-string";
import { BRAND_GRADIENT } from "./colors.js";

/** Runtime state passed into the status bar renderer. */
export interface StatusBarState {
  /** Active model name. */
  model: string;
  /** Total tokens used in the current session. */
  tokensUsed: number;
  /** Session start timestamp (ms since epoch). */
  sessionStarted: number;
  /** Number of memory/context hits. */
  memoryHits: number;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h${mins % 60}m`;
  if (mins > 0) return `${mins}m${secs % 60}s`;
  return `${secs}s`;
}

/**
 * Render the status bar to stdout.
 * Overwrites the current line using `\r` + ANSI clear-line.
 */
export function renderStatusBar(state: StatusBarState): void {
  const elapsed = formatDuration(Date.now() - state.sessionStarted);
  const tokens = state.tokensUsed > 1000
    ? `${(state.tokensUsed / 1000).toFixed(1)}k`
    : String(state.tokensUsed);

  const grad = gradient(BRAND_GRADIENT);

  const segments = [
    `${chalk.dim("model")} ${chalk.cyan(state.model)}`,
    `${chalk.dim("tokens")} ${grad(tokens)}`,
    `${chalk.dim("time")} ${chalk.magenta(elapsed)}`,
    `${chalk.dim("mem")} ${chalk.green(String(state.memoryHits))}`,
  ];

  const sep = chalk.dim(" │ ");
  const bar = `  ${segments.join(sep)}  `;
  process.stdout.write(`\x1b[2K\r${bar}`);
}

/**
 * Clear the status bar line (call before printing normal output).
 */
export function clearStatusBar(): void {
  process.stdout.write("\x1b[2K\r");
}
