/**
 * SNS-MyAgent splash — minimal banner + info block.
 * Single accent (cyan) for brand, default terminal text everywhere else.
 */
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUBTITLE = "snsagent — coding agent CLI";

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

export function renderSplash(info: SplashInfo = {}): string {
	const cols = process.stdout.columns ?? 80;
	const width = Math.min(cols - 4, 72);

	// Single brand mark, no rainbow
	const brandLine = `\n  ${chalk.cyan.bold("MY")}  ${chalk.bold("snsagent")}  ${chalk.dim(`v${readVersion()}`)}\n`;
	const subLine = `  ${chalk.dim(SUBTITLE)}\n`;

	// Separator
	const sep = chalk.dim("─".repeat(Math.min(width - 4, 60)));

	// Info rows: key dim, value default
	const rows: string[] = [sep];
	const kv = (k: string, v: string) =>
		`  ${chalk.dim(k.padEnd(12))}${v}`;
	if (info.model) rows.push(kv("Model", `${info.provider ?? "unknown"}/${info.model}`));
	if (info.cwd) rows.push(kv("Working Dir", info.cwd));
	if (info.platform) rows.push(kv("Platform", info.platform));
	rows.push(kv("Version", readVersion()));
	rows.push(sep);

	// Hints
	rows.push(`  ${chalk.dim("Type your message to start chatting.")}`);
	rows.push(`  ${chalk.dim("/exit or Ctrl+C to quit.")}`);

	return brandLine + subLine + "\n" + rows.join("\n") + "\n";
}

export function renderInlineHeader(info: SplashInfo = {}): string {
	const model = info.model
		? chalk.cyan(`${info.provider ?? "?"}/${info.model}`)
		: chalk.dim("no model");
	const ver = chalk.dim(`v${readVersion()}`);
	return `\n  ${chalk.cyan.bold("MY")}  ${chalk.bold("snsagent")} ${ver}  ${chalk.dim("│")}  ${model}\n`;
}
