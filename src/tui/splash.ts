/**
 * SNS Agent splash — clean, minimal, no boxes.
 * Orange accent dot + flat info rows. Zero OMP/Pi Agent visual language.
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

const DOT = chalk.hex("#F97316")("●");

export function renderSplash(info: SplashInfo = {}): string {
	const ver = readVersion();
	const lines: string[] = [];

	// Brand — orange dot + bold name + dim version
	lines.push(`  ${DOT} ${chalk.bold("SNS")}  ${chalk.dim(`v${ver}`)}`);
	lines.push("");

	// Status rows
	const row = (label: string, value: string) =>
		`  ${chalk.dim("·")} ${chalk.dim(label.padEnd(12))}${value}`;
	if (info.model) lines.push(row("model", `${info.provider ?? "unknown"}/${info.model}`));
	if (info.cwd) lines.push(row("dir", info.cwd));
	if (info.platform) lines.push(row("platform", info.platform));

	// Footer
	lines.push("");
	lines.push(`  ${chalk.dim("chat to configure · /help for commands")}`);

	return lines.join("\n") + "\n";
}

export function renderInlineHeader(info: SplashInfo = {}): string {
	const ver = readVersion();
	const model = info.model
		? chalk.cyan(`${info.provider ?? "?"}/${info.model}`)
		: chalk.dim("no model");
	return `  ${DOT} ${chalk.bold("SNS")} ${chalk.dim(`v${ver}`)}  ${chalk.dim("·")}  ${model}\n`;
}
