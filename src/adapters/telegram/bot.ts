/**
 * TelegramBot — polling-mode front-end for the SNS-MyAgent coding agent.
 *
 * Phase 1 surface (this file):
 *   - lifecycle: `start()` / `stop()` with graceful shutdown
 *   - outbound: `sendMessage(chatId, text)` returns the message id
 *   - inbound: every text message is parsed + routed via `handleMessage`
 *
 * Phase 2 (next iteration) will inject a real `forwardToAgent` that
 * drives an `AgentRegistry` session — see `handler.ts` for the stub.
 */

import { Bot, type Context } from "grammy";
import { logger } from "@oh-my-pi/pi-utils";
import { markdownToTelegram } from "./format";
import { parseMessage, resolveReply, type HandleContext } from "./handler";

export interface TelegramBotOptions {
	/** Bot token. If empty, the bot refuses to start. */
	readonly token: string;
	/** Optional agent hook. When omitted, the handler echoes with a marker. */
	forwardToAgent?: (text: string, sessionKey: string) => Promise<string>;
	/** Per\\-chat session store. Injectable for tests; defaults to a Map. */
	sessionStore?: Map<string, number>;
	/** Logger overrides. */
	logger?: typeof logger;
}

const MAX_TELEGRAM_MESSAGE = 4096;

/**
 * Wraps a grammY `Bot` and exposes a small lifecycle surface tailored
 * to the agent's startup/shutdown flow.
 */
export class TelegramBot {
	readonly #bot: Bot;
	readonly #opts: TelegramBotOptions;
	readonly #sessionStore: Map<string, number>;
	readonly #started: { value: boolean };
	#runningPromise: Promise<void> | undefined;

	constructor(opts: TelegramBotOptions) {
		if (!opts.token) throw new Error("TelegramBot: token is required");
		this.#opts = opts;
		this.#bot = new Bot(opts.token);
		this.#sessionStore = opts.sessionStore ?? new Map<string, number>();
		this.#started = { value: false };
		this.#wire();
	}

	/** Underlying grammY bot — exposed for advanced wiring + tests. */
	get raw(): Bot {
		return this.#bot;
	}

	/** True once `start()` has begun polling. */
	get started(): boolean {
		return this.#started.value;
	}

	/** Start long\\-polling. Resolves once grammY has opened the long\\-poll loop. */
	async start(): Promise<void> {
		if (this.#started.value) {
			throw new Error("TelegramBot: already started");
		}
		this.#started.value = true;
		this.#runningPromise = this.#bot.start({
			onStart: (info) => {
				logger.debug("telegram: bot online", {
					username: info.username,
					id: info.id,
				});
			},
		});
	}

	/**
	 * Graceful shutdown. Stops the polling loop and waits for in\\-flight
	 * handlers to settle (with a short timeout so a stuck agent can't
	 * hang process exit).
	 */
	async stop(): Promise<void> {
		if (!this.#started.value) return;
		await this.#bot.stop();
		this.#started.value = false;
		if (this.#runningPromise) {
			try {
				await Promise.race([
					this.#runningPromise,
					new Promise<void>((resolve) => setTimeout(resolve, 1500)),
				]);
			} catch (error) {
				logger.debug("telegram: shutdown race failed", { error: String(error) });
			}
		}
	}

	/**
	 * Send a reply. Telegram limits messages to 4096 chars; we chunk
	 * automatically and return the id of the LAST message sent (so
	 * callers can chain follow\\-ups if they care).
	 */
	async sendMessage(chatId: number, text: string): Promise<number> {
		const formatted = markdownToTelegram(text);
		const chunks = chunkText(formatted, MAX_TELEGRAM_MESSAGE);
		let lastId = 0;
		for (const chunk of chunks) {
			const sent = await this.#bot.api.sendMessage(chatId, chunk, {
				parse_mode: "MarkdownV2",
			});
			lastId = sent.message_id;
		}
		return lastId;
	}

	/** Send a plain\\-text message (no MarkdownV2 parsing). */
	async sendPlain(chatId: number, text: string): Promise<number> {
		const sent = await this.#bot.api.sendMessage(chatId, text);
		return sent.message_id;
	}

	/** Test\\-only: simulate an inbound update without going through Telegram. */
	async __handleUpdateForTests(ctx: Context): Promise<void> {
		await this.#onMessage(ctx);
	}

	#wire(): void {
		this.#bot.on("message", (ctx) => {
			void this.#onMessage(ctx);
		});
		this.#bot.catch((err) => {
			logger.debug("telegram: bot error", { error: String(err) });
		});
	}

	async #onMessage(ctx: Context): Promise<void> {
		const msg = ctx.message;
		if (!msg) return;
		const parsed = parseMessage(msg);
		const sessionKey = String(parsed.chatId);
		this.#sessionStore.set(sessionKey, (this.#sessionStore.get(sessionKey) ?? 0) + 1);

		const handleCtx: HandleContext = {
			sessionKey,
			forwardToAgent: this.#opts.forwardToAgent,
		};
		try {
			const reply = await resolveReply(parsed, handleCtx);
			await ctx.reply(reply, { parse_mode: "MarkdownV2" });
		} catch (error) {
			// MarkdownV2 parse errors fall back to plain text — never lose the reply.
			const fallback = (error as Error)?.message ?? String(error);
			logger.debug("telegram: markdown send failed, retrying plain", { error: fallback });
			try {
				await ctx.reply(await replyFromContext(parsed, handleCtx), { parse_mode: undefined });
			} catch (error2) {
				logger.debug("telegram: plain send also failed", { error: String(error2) });
			}
		}
	}
}

async function replyFromContext(parsed: Parameters<typeof resolveReply>[0], ctx: HandleContext): Promise<string> {
	return resolveReply(parsed, ctx);
}

/** Split a MarkdownV2 string into ≤limit chunks, preferring newline boundaries. */
export function chunkText(text: string, limit: number): string[] {
	if (text.length <= limit) return [text];
	const out: string[] = [];
	let rest = text;
	while (rest.length > limit) {
		let cut = rest.lastIndexOf("\n", limit);
		if (cut < limit * 0.5) cut = rest.lastIndexOf(" ", limit);
		if (cut < limit * 0.5) cut = limit;
		out.push(rest.slice(0, cut));
		rest = rest.slice(cut).replace(/^\n/, "");
	}
	if (rest.length > 0) out.push(rest);
	return out;
}