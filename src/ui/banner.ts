/**
 * Premium ASCII art banner for SNS-MyAgent.
 *
 * Renders the branded logo + runtime info using chalk, gradient-string, and boxen.
 * Called at the start of `snscoder launch`.
 */

import chalk from "chalk";
import gradient from "gradient-string";
import boxen from "boxen";
import type { FullConfig } from "#src/config/index.js";
import { loadSnsConfig } from "#src/config/sns-config.js";
import { BRAND_GRADIENT, ACCENT_GRADIENT } from "./colors.js";

const LOGO = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ╚██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝   ╚═╝ ╚═════╝ ╚══════╝`;

const SUBTITLE = "My-Agent • SnsCoder CLI";

/**
 * Show the premium banner with gradient logo + config info.
 * Called at the start of `snscoder launch`.
 */
export function showBanner(config: FullConfig): void {
  const cols = process.stdout.columns ?? 80;
  const width = Math.min(cols - 2, 64);

  // Gradient logo
  const bannerLines = LOGO.split("\n").filter(l => l.trim().length > 0);
  const coloredLogo = bannerLines
    .map(l => gradient(BRAND_GRADIENT).multiline(l))
    .join("\n");

  // Subtitle
  const subtitle = gradient(ACCENT_GRADIENT)(SUBTITLE);

  // Info block
  const version = chalk.bold(`v${config.version}`);
  const provider = chalk.cyan(config.provider);
  const model = chalk.cyan(config.model);
  const hasKey = Boolean(loadSnsConfig().apiKey);
  const memStatus = hasKey
    ? chalk.green("✓ API key set")
    : chalk.yellow("⚠ no API key (BYOK)");

  const inner = Math.min(width - 4, 56);
  const sep = chalk.dim("─".repeat(inner));
  const kv = (k: string, v: string) =>
    `  ${chalk.dim(k.padEnd(12))}${chalk.white(v)}`;

  const info = [
    sep,
    kv("Version", version),
    kv("Provider", provider),
    kv("Model", model),
    kv("Memory", memStatus),
    sep,
    chalk.dim("  Type your message to start chatting."),
    chalk.dim("  /exit or Ctrl+C to quit."),
  ].join("\n");

  // Wrap in boxen
  const content = `${coloredLogo}\n${subtitle}\n${info}`;

  const box = boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "cyan",
    width,
    textAlignment: "center",
  });

  console.log(box);
  console.log();
}
