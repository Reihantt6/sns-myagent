/**
 * ASCII art banner for SNS-MyAgent.
 *
 * Renders the snscoder logo + runtime info on `snscoder chat`.
 */

import type { FullConfig } from "#src/config/index.js";
import { accent, bold, muted, primary, success, warning } from "./colors.js";
import { loadSnsConfig } from "#src/config/sns-config.js";

const LOGO = [
	`  ___            _      ___                _`,
	` / __| ___  __ _| |__  / __|___  ___  __ _| |___`,
	` \\__ \\/ _ \\/ _\` | '_ \\| |  / __|/ _ \\/ _\` | / __|`,
	` |___/\\___/\\__,_|_.__/|_|  \\___|\\___/\\__,_|_\\___|`,
].join("\n");

/**
 * Show the banner with config info.
 * Called at the start of `snscoder chat`.
 */
export function showBanner(config: FullConfig): void {
	const line = muted("─".repeat(52));

	console.log();
	console.log(accent(LOGO));
	console.log(line);

	const version = bold(`v${config.version}`);
	const provider = primary(config.provider);
	const model = primary(config.model);
	const hasKey = Boolean(loadSnsConfig().apiKey);
	const memStatus = hasKey ? success("✓ API key set") : warning("⚠ no API key (BYOK)");

	console.log(`  ${muted("version")}  ${version}`);
	console.log(`  ${muted("provider")} ${provider}`);
	console.log(`  ${muted("model")}    ${model}`);
	console.log(`  ${muted("memory")}   ${memStatus}`);
	console.log(line);
	console.log();
}
