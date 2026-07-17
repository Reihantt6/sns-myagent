/**
 * SNS Agent banner — flat, no boxen, no gradient boxes.
 * Orange accent + minimal info block. Completely different from OMP/Pi Agent.
 */

import chalk from "chalk";
import type { FullConfig } from "#src/config/index.js";
import { loadSnsConfig } from "#src/config/sns-config.js";

const LOGO = [
	"  ███████╗",
	"  ██╔════╝",
	"  ███████╗",
	"  ╚════██║",
	"  ███████║",
	"  ╚══════╝",
];

const LOGO_TEXT = [
	"  ███████╗███╗   ██╗███████╗    ██╗   ██╗██╗   ██╗",
	"  ██╔════╝████╗  ██║██╔════╝    ██║   ██║╚██╗ ██╔╝",
	"  ███████╗██╔██╗ ██║███████╗    ██║   ██║ ╚████╔╝ ",
	"  ╚════██║██║╚██╗██║╚════██║    ╚██╗ ██╔╝  ╚██╔╝  ",
	"  ███████║██║ ╚████║███████║     ╚████╔╝    ██║   ",
	"  ╚══════╝╚═╝  ╚═══╝╚══════╝      ╚═══╝     ╚═╝   ",
];

const SUBTITLE = "SNS · coding agent";

export function showBanner(config: FullConfig): void {
	const cols = process.stdout.columns ?? 80;

	const version = chalk.bold(`v${config.version}`);
	const provider = chalk.cyan(config.provider);
	const model = chalk.cyan(config.model);
	const hasKey = Boolean(loadSnsConfig().apiKey);
	const memStatus = hasKey
		? chalk.green("connected")
		: chalk.yellow("no API key");

	const inner = Math.min(cols - 4, 56);
	const sep = chalk.dim("─".repeat(inner));
	const kv = (k: string, v: string) =>
		`  ${chalk.dim(k.padEnd(12))}${v}`;

	const info = [
		"",
		...LOGO_TEXT.map(l => chalk.hex("#F97316")(l)),
		"",
		chalk.hex("#F97316")(SUBTITLE),
		"",
		sep,
		kv("version", version),
		kv("provider", provider),
		kv("model", model),
		kv("memory", memStatus),
		sep,
		"",
		chalk.dim("  start chatting to configure your agent"),
		chalk.dim("  /help for commands · /exit to quit"),
		"",
	].join("\n");

	console.log(info);
}
