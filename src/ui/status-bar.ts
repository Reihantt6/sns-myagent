/**
 * Status bar — flat single line, dim key + cyan value.
 */

import chalk from "chalk";

export interface StatusBarState {
	model: string;
	tokensUsed: number;
	sessionStarted: number;
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

export function renderStatusBar(state: StatusBarState): void {
	const elapsed = formatDuration(Date.now() - state.sessionStarted);
	const tokens = state.tokensUsed > 1000
		? `${(state.tokensUsed / 1000).toFixed(1)}k`
		: String(state.tokensUsed);

	const k = (s: string) => chalk.dim(s);
	const v = (s: string) => chalk.cyan(s);
	const sep = chalk.dim(" · ");

	const bar = `  ${k("model")} ${v(state.model)}${sep}${k("tokens")} ${v(tokens)}${sep}${k("time")} ${v(elapsed)}${sep}${k("mem")} ${v(String(state.memoryHits))}`;

	process.stdout.write(`\x1b[2K\r${bar}`);
}

export function clearStatusBar(): void {
	process.stdout.write("\x1b[2K\r");
}
