#!/usr/bin/env bun
// Single-file CLI entry for `bun build --compile`.
// Mirrors bin/snsagent (Node dev shim) but is a TS module so Bun can bundle
// all transitive imports into the binary.

import { ensureConfig } from "../config/loader.js";
import { runCli } from "./index.js";


const commandsNeedingConfig = new Set(["config", "chat", "telegram"]);
const argv = process.argv.slice(2);
const head = argv[0];

// Auto-boot the Telegram polling adapter only for agent entry points. Other
// commands (especially `version` and `help`) must remain short-lived utilities
// and must not start a background network client. `launch` is included because
// it is the explicit form of the default agent command and main.ts does not
// wire Telegram itself. Disable autostart with SNS_TELEGRAM_AUTOSTART=0.
async function maybeAutostartTelegram(): Promise<void> {
	if (head !== undefined && head !== "agent" && head !== "launch") return;
	if (process.env.SNS_TELEGRAM_AUTOSTART === "0") return;
	const token = process.env.SNS_TELEGRAM_BOT_TOKEN;
	if (!token) return;

	// Keep short-lived commands free of Grammy, the SDK, and extension-runtime
	// imports. The bridge is only needed for an actual agent launch.
	const [{ startTelegramAdapter }, { createForwardToAgent, getBridgeStats, resetChatSession }] = await Promise.all([
		import("../adapters/telegram/index.js"),
		import("../adapters/telegram/bridge.js"),
	]);
	const agentForwarder = createForwardToAgent();
	const forwardToAgent = (text: string, sessionKey: string) =>
		agentForwarder(sessionKey, "telegram", text);
	startTelegramAdapter(token, {
		autostart: true,
		forwardToAgent,
		resetChatSession,
		getBridgeStats,
	});
}

try {
	if (head !== undefined && commandsNeedingConfig.has(head) && !process.env.SNS_NO_BOOTSTRAP) {
		ensureConfig();
	}
	await maybeAutostartTelegram();
	const code = await runCli(argv);
	if (code !== 0) process.exit(code);
} catch (err) {
	const e = err as Error;
	const msg = e.message ? e.message : String(err);
	process.stderr.write(`\u2717 snsagent crashed: ${msg}\n`);
	if (process.env.SNS_DEBUG) {
		process.stderr.write("\n" + (e.stack ?? "") + "\n");
	}
	process.exit(1);
}
