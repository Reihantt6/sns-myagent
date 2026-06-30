/**
 * Command palette — fuzzy command overlay.
 * Minimal: cyan highlight, dim for secondary. No gradient.
 */

import chalk from "chalk";

export interface PaletteCommand {
	name: string;
	description: string;
	category: string;
	shortcut?: string;
	enabled?: boolean;
}

export interface CommandPaletteOptions {
	commands: PaletteCommand[];
	query?: string;
	highlighted?: number;
	width?: number;
}

export const CHAT_COMMANDS: PaletteCommand[] = [
	{ name: "/help", description: "Show available commands", category: "General", shortcut: "?" },
	{ name: "/clear", description: "Clear screen", category: "General", shortcut: "⌘K" },
	{ name: "/exit", description: "Quit the chat", category: "General", shortcut: "⌘Q" },
	{ name: "/model", description: "Show/switch model", category: "Config" },
	{ name: "/history", description: "Show conversation history", category: "General" },
	{ name: "/memory", description: "Recall from memory", category: "Memory" },
	{ name: "/skills", description: "List available skills", category: "Extensibility" },
	{ name: "/plugins", description: "List installed plugins", category: "Extensibility" },
	{ name: "/mcp", description: "MCP server management", category: "Extensibility" },
	{ name: "/theme", description: "Change terminal theme", category: "Config" },
	{ name: "/bench", description: "Run benchmarks", category: "Debug" },
	{ name: "/debug", description: "Debug info", category: "Debug" },
];

export function renderCommandPalette(opts: CommandPaletteOptions): string {
	const { commands, query = "", highlighted = 0, width = 60 } = opts;
	const filtered = commands.filter(
		(c) => c.enabled !== false &&
			(c.name.toLowerCase().includes(query.toLowerCase()) ||
				c.description.toLowerCase().includes(query.toLowerCase()) ||
				c.category.toLowerCase().includes(query.toLowerCase()))
	);

	const cols = process.stdout.columns ?? 80;
	const width2 = Math.min(opts.width ?? cols, cols) - 4;

	const lines: string[] = [];

	// Header
	const search = chalk.cyan("? ") + query + chalk.dim(" (↑↓ navigate, Enter select, Esc cancel)");
	lines.push(chalk.dim("─".repeat(60)));
	lines.push(`  ${chalk.cyan("?")} ${query}${chalk.dim(" (↑↓ Enter Esc)")}`);
	lines.push("");

	if (filtered.length === 0) {
		lines.push(chalk.dim("  No commands match"));
	} else {
		filtered.forEach((cmd, idx) => {
			const isActive = idx === highlighted;
			const prefix = isActive ? chalk.cyan("► ") : "  ";
			const name = isActive ? chalk.cyan.bold(cmd.name) : chalk.cyan(cmd.name);
			const desc = chalk.dim(cmd.description);
			const cat = chalk.dim(` [${cmd.category}]`);
			const shortcut = cmd.shortcut ? chalk.dim(` ${cmd.shortcut}`) : "";
			lines.push(`${prefix}${name}${cat}${shortcut}`);
		});
	}

	lines.push("");
	lines.push(chalk.dim("─".repeat(60)));

	return lines.join("\n");
}