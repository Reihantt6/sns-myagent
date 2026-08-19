/**
 * Public surface for the Telegram adapter.
 *
 * - `TelegramBot` — class, lifecycle, send/receive.
 * - `markdownToTelegram`, `stripMarkdown` — formatting helpers.
 * - `parseMessage`, `resolveReply` — handler primitives (re-exported for tests).
 * - `startTelegramAdapter()` — auto-boot helper used by the main entry point.
 *
 * Auto\\-boot behaviour: when `SNS_TELEGRAM_BOT_TOKEN` is set in the
 * environment, importing this module also kicks off polling so the
 * adapter comes online as soon as the CLI is launched. Disable with
 * `SNS_TELEGRAM_AUTOSTART=0`.
 */

export { TelegramBot, chunkText, type TelegramBotOptions } from "./bot";
export { markdownToTelegram, stripMarkdown } from "./format";
export {
	parseMessage,
	resolveReply,
	COMMAND_REPLIES,
	type ParsedMessage,
	type TelegramCommand,
	type HandleContext,
} from "./handler";

import { logger } from "@oh-my-pi/pi-utils";
import { TelegramBot } from "./bot";

let activeBot: TelegramBot | undefined;
let shuttingDown = false;

/**
 * Boot the adapter if a token is configured. Returns the live instance
 * (or `undefined` if autostart is disabled / token missing). Safe to
 * call multiple times — subsequent calls return the existing instance.
 */
export function startTelegramAdapter(
	token: string | undefined = process.env.SNS_TELEGRAM_BOT_TOKEN,
	opts: {
		autostart?: boolean;
		forwardToAgent?: (text: string, sessionKey: string) => Promise<string>;
		resetChatSession?: (chatId: string) => boolean;
		getBridgeStats?: () => { activeSessions: number; chatIds: string[] };
		allowedUserIds?: Set<number>;
	} = {},
): TelegramBot | undefined {
	if (activeBot) return activeBot;
	if (!token) return undefined;
	const autostart = opts.autostart ?? process.env.SNS_TELEGRAM_AUTOSTART !== "0";
	if (!autostart) return undefined;

	const bot = new TelegramBot({
		token,
		forwardToAgent: opts.forwardToAgent,
		resetChatSession: opts.resetChatSession,
		getBridgeStats: opts.getBridgeStats,
		allowedUserIds: opts.allowedUserIds,
	});
	activeBot = bot;

	// The adapter runs agent actions with auto-approve. If no allowlist is
	// configured, every user who can reach the bot can drive those actions.
	if (opts.allowedUserIds === undefined) {
		logger.warn(
			"telegram: no SNS_TELEGRAM_ALLOWED_USERS allowlist — the bot will execute agent actions for ANY user who can message it",
		);
	} else if (opts.allowedUserIds.size === 0) {
		// Empty set = the env var was set but every entry was junk/invalid.
		// Fail closed: the bot denies every user instead of opening up.
		logger.warn(
			"telegram: SNS_TELEGRAM_ALLOWED_USERS was set but contained no valid user ids — the bot will DENY all users (fail closed)",
		);
	}

	bot.start().catch((error) => {
		logger.debug("telegram: autostart failed", { error: String(error) });
		activeBot = undefined;
	});

	const shutdown = (): void => {
		if (shuttingDown) return;
		shuttingDown = true;
		bot.stop().catch((error) => {
			logger.debug("telegram: stop failed", { error: String(error) });
		});
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);

	return bot;
}

/**
 * Parse `SNS_TELEGRAM_ALLOWED_USERS` (comma-separated numeric user ids) into a
 * `Set<number>`. Returns `undefined` when the var is unset/empty so callers can
 * distinguish "no restriction" from "explicit empty allowlist".
 *
 * Entries that are not safe integers (junk like `abc`, `0`, `-5`, or values
 * beyond `Number.MAX_SAFE_INTEGER` that would lose int64 precision) are
 * skipped. If every entry is invalid the result is an EMPTY set — callers
 * treat that as fail-closed (deny all), never as open.
 */
export function resolveTelegramAllowedUsers(
	raw: string | undefined = process.env.SNS_TELEGRAM_ALLOWED_USERS,
): Set<number> | undefined {
	const trimmed = raw?.trim();
	if (!trimmed) return undefined;
	const ids = new Set<number>();
	for (const part of trimmed.split(",")) {
		const value = Number(part.trim());
		// Telegram user ids are signed 64-bit; anything outside the safe
		// integer range cannot match a real id and would silently fail open
		// if kept (a 1e+26 value never equals a real id, but keeping it also
		// hides the config error). Reject it instead.
		if (Number.isSafeInteger(value) && value > 0) ids.add(value);
	}
	return ids;
}

/** Stop the autostarted instance (if any). Test\\-only helper. */
export async function stopTelegramAdapter(): Promise<void> {
	if (!activeBot) return;
	await activeBot.stop().catch(() => {});
	activeBot = undefined;
	shuttingDown = true;
}