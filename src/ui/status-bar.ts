/**
 * Status bar for SNS-MyAgent terminal UI.
 *
 * Renders a bottom-line summary: model, tokens, session time, memory hits.
 * Uses ANSI to draw a single-line bar at the bottom of the terminal.
 */

import { accent, muted, primary, success } from "./colors.js";

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

	const segments = [
		`${muted("model")} ${primary(state.model)}`,
		`${muted("tokens")} ${accent(tokens)}`,
		`${muted("time")} ${accent(elapsed)}`,
		`${muted("memory")} ${success(String(state.memoryHits))}`,
	];

	const bar = `  ${segments.join(muted(" │ "))}  `;
	process.stdout.write(`\x1b[2K\r${bar}`);
}

/**
 * Clear the status bar line (call before printing normal output).
 */
export function clearStatusBar(): void {
	process.stdout.write("\x1b[2K\r");
}
