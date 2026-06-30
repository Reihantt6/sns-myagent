/**
 * SNS-MyAgent splash — flat list, no boxes.
 * Single line brand + `●` prefixed info rows. No rounded borders, no
 * gradient, no separator boxes. Reads like a status line.
 */
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function readVersion(): string {
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const candidates = [
			resolve(here, "..", "..", "package.json"),
			resolve(here, "..", "package.json"),
			resolve(here, "..", "..", "dist", "package.json"),
		];
		for (const pkgPath of candidates) {
			try {
				const raw = readFileSync(pkgPath, "utf8");
				const pkg = JSON.parse(raw) as { version?: string };
				if (pkg.version && pkg.version !== "0.0.0") return pkg.version;
			} catch {}
		}
		let dir = process.cwd();
		for (let i = 0; i < 5; i++) {
			try {
				const raw = readFileSync(resolve(dir, "package.json"), "utf8");
				const pkg = JSON.parse(raw) as { name?: string; version?: string };
				if (pkg.name === "@sns-myagent/cli" && pkg.version) return pkg.version;
			} catch {}
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
		return "0.0.0";
	} catch {
		return "0.0.0";
	}
}

export interface SplashInfo {
	model?: string;
	provider?: string;
	cwd?: string;
	platform?: string;
	nodeVersion?: string;
}

/**
 * One-line prefix used throughout the TUI.
 * `●` = present, default text. No rounded boxes.
 */
const BULLET = chalk.cyan("●");

export function renderSplash(info: SplashInfo = {}): string {
	const ver = readVersion();
	const lines: string[] = [];

	// Brand line: MY · snsagent · v0.3.6
	lines.push(`  ${chalk.cyan.bold("MY")}  ${chalk.bold("snsagent")}  ${chalk.dim(`v${ver}`)}`);
	lines.push(`  ${chalk.dim("coding agent CLI")}`);
	lines.push("");

	// Status lines — flat, one per line, ● prefix
	const row = (label: string, value: string) => `  ${BULLET} ${chalk.dim(label.padEnd(13))}${value}`;
	if (info.model) lines.push(row("model", `${info.provider ?? "unknown"}/${info.model}`));
	if (info.cwd) lines.push(row("dir", info.cwd));
	if (info.platform) lines.push(row("platform", info.platform));
	lines.push(row("version", ver));

	// Hints
	lines.push("");
	lines.push(`  ${chalk.dim("type to chat · /exit to quit")}`);

	return lines.join("\n") + "\n";
}

export function renderInlineHeader(info: SplashInfo = {}): string {
	const ver = readVersion();
	const model = info.model
		? chalk.cyan(`${info.provider ?? "?"}/${info.model}`)
		: chalk.dim("no model");
	return `  ${chalk.cyan.bold("MY")}  ${chalk.bold("snsagent")} ${chalk.dim(`v${ver}`)}  ${chalk.dim("·")}  ${model}\n`;
}
