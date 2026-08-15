/**
 * Telegram bot-token resolution for the `telegram start` subcommand.
 *
 * Kept in its own module (no side effects) so the precedence logic is unit
 * testable without importing the rest of the CLI router.
 */

/**
 * Resolve the bot token with the precedence documented in `telegram start
 * --help`: flag > env > config. Empty and whitespace-only values are treated as
 * absent, so `--token ""` (or an empty `telegram.token` config field) still
 * falls through to the next source instead of silently producing a token the
 * probe then rejects as "no token".
 */
export function resolveTelegramToken(
	flagToken: string | undefined,
	envToken: string | undefined,
	configToken: string | undefined,
): string | undefined {
	for (const candidate of [flagToken, envToken, configToken]) {
		const trimmed = candidate?.trim();
		if (trimmed) return trimmed;
	}
	return undefined;
}
