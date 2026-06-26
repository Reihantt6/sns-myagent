/**
 * SNS-MyAgent splash screen — branded gradient banner + system info blocks.
 * Premium terminal UI with gradient logo, rounded box, and info panel.
 */
import chalk from "chalk";
import gradient from "gradient-string";
import boxen from "boxen";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BANNER_ART = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ╚██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝   ╚═╝ ╚═════╝ ╚══════╝`;

const SUBTITLE = "My-Agent • SnsCoder CLI";

const SNY_GRADIENT = ["#00d2ff", "#7b2ff7", "#ff6b9d"];
const ACCENT_GRADIENT = ["#7b2ff7", "#00d2ff"];

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, "..", "..", "package.json");
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? "0.0.0";
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

function makeInfoBlocks(info: SplashInfo, width: number): string {
  const inner = Math.min(width - 4, 56);
  const sep = chalk.dim("─".repeat(inner));

  const rows: string[] = [];
  const kv = (k: string, v: string) =>
    `  ${chalk.dim(k.padEnd(12))}${chalk.white(v)}`;

  rows.push(sep);
  if (info.model) rows.push(kv("Model", `${info.provider ?? "unknown"}/${info.model}`));
  if (info.cwd) rows.push(kv("Working Dir", info.cwd));
  if (info.platform) rows.push(kv("Platform", info.platform));
  rows.push(kv("Version", readVersion()));
  rows.push(sep);

  const hint = chalk.dim("  Type your message to start chatting.");
  const exit = chalk.dim("  /exit or Ctrl+C to quit.");
  rows.push(hint);
  rows.push(exit);

  return rows.join("\n");
}

export function renderSplash(info: SplashInfo = {}): string {
  const cols = process.stdout.columns ?? 80;
  const bannerWidth = Math.min(cols - 2, 64);

  // Gradient banner
  const bannerLines = BANNER_ART.split("\n").filter(l => l.trim().length > 0);
  const coloredBanner = bannerLines
    .map(l => gradient(SNY_GRADIENT).multiline(l))
    .join("\n");

  // Subtitle
  const subtitle = gradient(ACCENT_GRADIENT)(SUBTITLE);

  // Info block
  const infoBlock = makeInfoBlocks(info, bannerWidth);

  // Wrap in boxen
  const content = `${coloredBanner}\n${subtitle}\n${infoBlock}`;

  const box = boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: "cyan",
    width: bannerWidth,
    textAlignment: "center",
  });

  return box;
}

export function renderInlineHeader(info: SplashInfo = {}): string {
  const model = info.model
    ? chalk.cyan(`${info.provider ?? "?"}/${info.model}`)
    : chalk.dim("no model");
  const ver = chalk.dim(`v${readVersion()}`);
  return `\n  ${gradient(SNY_GRADIENT)("SnsCoder")} ${ver}  ${chalk.dim("│")}  ${model}\n`;
}
