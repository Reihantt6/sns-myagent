/**
 * SNS-MyAgent CLI entry point.
 * Thin wrapper that delegates to the main runCli function.
 * Subcommands: snscoder [chat|setup|--version|--help]
 */
import { runCli } from "../cli.js";

const args = process.argv.slice(2);

// Map "chat" → default launch behavior (pass through)
// Map "setup" → existing setup subcommand
// --version handled by pi-utils run()
runCli(args).catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
