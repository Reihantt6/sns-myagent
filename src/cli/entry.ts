#!/usr/bin/env bun
// Single-file CLI entry for `bun build --compile`.
// Mirrors bin/snscoder (Node dev shim) but is a TS module so Bun can bundle
// all transitive imports into the binary.

import { ensureConfig } from "../config/loader.js";
import { runCli } from "./index.js";
import { startTelegramAdapter } from "../adapters/telegram/index.js";

const commandsNeedingConfig = new Set(["config", "chat", "telegram"]);
const argv = process.argv.slice(2);
const head = argv[0];

// Auto-boot the Telegram polling adapter when a token is present and the
// user is not explicitly running a different subcommand. Disable with
// SNS_TELEGRAM_AUTOSTART=0.
function maybeAutostartTelegram(): void {
	if (head === "telegram") return; // explicit start/stop handles its own lifecycle
	if (process.env.SNS_TELEGRAM_AUTOSTART === "0") return;
	const token = process.env.SNS_TELEGRAM_BOT_TOKEN;
	if (!token) return;
	startTelegramAdapter(token, { autostart: true });
}

try {
	if (head !== undefined && commandsNeedingConfig.has(head) && !process.env.SNS_NO_BOOTSTRAP) {
		ensureConfig();
	}
	maybeAutostartTelegram();
	const code = await runCli(argv);
	if (code !== 0) process.exit(code);
} catch (err) {
	const e = err as Error;
	const msg = e.message ? e.message : String(err);
	process.stderr.write(`\u2717 snscoder crashed: ${msg}\n`);
	if (process.env.SNS_DEBUG) {
		process.stderr.write("\n" + (e.stack ?? "") + "\n");
	}
	process.exit(1);
}
