/**
 * `snsagent chat` — interactive chat subcommand.
 *
 * Shows the snsagent banner, then delegates to the existing launch/agent
 * infrastructure for the actual LLM interaction loop.
 */

import { Command } from "@oh-my-pi/pi-utils/cli";
import { loadConfig } from "#src/config/index.js";
import { showBanner } from "#src/ui/banner.js";
import { parseArgs } from "../cli/args.js";
import { runRootCommand } from "../main.js";

export default class Chat extends Command {
	static description = "Interactive chat with the snsagent agent";
	static strict = false;

	async run(): Promise<void> {
		const config = loadConfig();
		showBanner(config);
		const parsed = parseArgs(this.argv);
		await runRootCommand(parsed, this.argv);
	}
}
