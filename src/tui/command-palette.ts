/**
 * Command palette — flat list, no box.
 * Cyan highlight on selected row, dim otherwise.
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
	const { commands, query = "", highlighted = 0 } = opts;
	const filtered = commands.filter(
		(c) => c.enabled !== false &&
			(c.name.toLowerCase().includes(query.toLowerCase()) ||
				c.description.toLowerCase().includes(query.toLowerCase()) ||
				c.category.toLowerCase().includes(query.toLowerCase()))
	);

	const lines: string[] = [];

	// Search line
	lines.push(`  ${chalk.hex("#F97316")("?")} ${query}${chalk.dim("  (↑↓ navigate · Enter select · Esc cancel)")}`);
	lines.push("");

	if (filtered.length === 0) {
		lines.push(`  ${chalk.dim("no commands match")}`);
	} else {
		filtered.forEach((cmd, idx) => {
			const isActive = idx === highlighted;
			const prefix = isActive ? chalk.hex("#F97316")("●") : " ";
			const name = isActive ? chalk.hex("#F97316").bold(cmd.name) : chalk.hex("#F97316")(cmd.name);
			const desc = chalk.dim(cmd.description);
			const cat = chalk.dim(`  [${cmd.category}]`);
			const shortcut = cmd.shortcut ? chalk.dim(`  ${cmd.shortcut}`) : "";
			lines.push(`  ${prefix} ${name}${cat}${shortcut}`);
			if (isActive) {
				lines.push(`    ${desc}`);
			}
		});
	}

	return lines.join("\n");
}
