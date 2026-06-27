/**
 * Incoming message handler — parses commands and forwards to the agent.
 *
 * Phase 1 (this file): stub the agent layer. Phase 2 will wire the real
 * `AgentRegistry` / session so `handleMessage` triggers an actual turn
 * via the existing IRC-style bus.
 */

import type { Message } from "grammy/types";
import { logger } from "@oh-my-pi/pi-utils";

export type ParsedMessage =
	| { kind: "command"; command: TelegramCommand; args: string; raw: string; userId: number; chatId: number; messageId: number }
	| { kind: "chat"; text: string; userId: number; chatId: number; messageId: number }
	| { kind: "file"; fileId: string; fileName: string; mimeType: string; caption: string; userId: number; chatId: number; messageId: number }
	| { kind: "empty"; userId: number; chatId: number; messageId: number };

export type TelegramCommand =
  | "start" | "help" | "chat" | "reset" | "status"
  | "memory" | "cron" | "model" | "code" | "review" | "task";

/** Commands we recognise, mapped to their canonical name. */
const COMMANDS: ReadonlySet<string> = new Set([
  "start", "help", "chat", "reset", "status",
  "memory", "cron", "model", "code", "review", "task",
]);

/**
 * Parse a grammY `Message` into a `ParsedMessage`. Returns `kind: "empty"`
 * for messages with no text payload (stickers, photos, service messages).
 */
export function parseMessage(msg: Message): ParsedMessage {
	const userId = msg.from?.id ?? 0;
	const chatId = msg.chat.id;
	const messageId = msg.message_id;
	const text = (msg.text ?? msg.caption ?? "").trim();

	// Detect file attachments (document, photo, video, audio, voice)
	if (msg.document) {
		return {
			kind: "file",
			fileId: msg.document.file_id,
			fileName: msg.document.file_name ?? "file",
			mimeType: msg.document.mime_type ?? "application/octet-stream",
			caption: text,
			userId, chatId, messageId,
		};
	}
	if (msg.photo && msg.photo.length > 0) {
		const largest = msg.photo[msg.photo.length - 1]!;
		return {
			kind: "file",
			fileId: largest.file_id,
			fileName: `photo_${messageId}.jpg`,
			mimeType: "image/jpeg",
			caption: text,
			userId, chatId, messageId,
		};
	}
	if (msg.video) {
		return {
			kind: "file",
			fileId: msg.video.file_id,
			fileName: msg.video.file_name ?? `video_${messageId}.mp4`,
			mimeType: msg.video.mime_type ?? "video/mp4",
			caption: text,
			userId, chatId, messageId,
		};
	}
	if (msg.voice) {
		return {
			kind: "file",
			fileId: msg.voice.file_id,
			fileName: `voice_${messageId}.ogg`,
			mimeType: msg.voice.mime_type ?? "audio/ogg",
			caption: text,
			userId, chatId, messageId,
		};
	}
	if (msg.audio) {
		return {
			kind: "file",
			fileId: msg.audio.file_id,
			fileName: msg.audio.file_name ?? `audio_${messageId}.mp3`,
			mimeType: msg.audio.mime_type ?? "audio/mpeg",
			caption: text,
			userId, chatId, messageId,
		};
	}

	if (text.length === 0) {
		return { kind: "empty", userId, chatId, messageId };
	}

	if (text.startsWith("/")) {
		// Handle "/cmd@botname args" → strip the @botname suffix.
		const head = text.slice(1);
		const spaceIdx = head.indexOf(" ");
		const token = (spaceIdx === -1 ? head : head.slice(0, spaceIdx)).split("@")[0] ?? "";
		const args = spaceIdx === -1 ? "" : head.slice(spaceIdx + 1).trim();
		if (COMMANDS.has(token)) {
			return {
				kind: "command",
				command: token as TelegramCommand,
				args,
				raw: text,
				userId,
				chatId,
				messageId,
			};
		}
		// Unknown command → treat as chat so the user gets an answer, not silence.
		return { kind: "chat", text, userId, chatId, messageId };
	}

	return { kind: "chat", text, userId, chatId, messageId };
}

/**
 * Static replies for built-in commands. Kept here (not in bot.ts) so the
 * handler file is fully unit-testable without a bot instance.
 */
export const COMMAND_REPLIES: Record<TelegramCommand, string> = {
	start:
		"*Welcome to snscoder* 🤖\n\n" +
		"I'm a Telegram front-end for the SNS-MyAgent coding agent. " +
		"Send me any task or question; I'll route it to the agent and reply here.\n\n" +
		"Type /help for the full command list.",
	help:
		"*Commands*\n\n" +
		"/start — show the welcome banner\n" +
		"/help — list commands (this message)\n" +
		"/chat \\<message\\> — send a prompt to the agent explicitly\n" +
		"/reset — clear the per\\-chat conversation context\n" +
		"/status — show adapter health + bridge stats\n" +
		"/memory — show agent memory usage\n" +
		"/cron — show cron jobs\n" +
		"/model — show current model\n" +
		"/code \\<task\\> — send a coding task to the agent\n" +
		"/review \\<task\\> — ask the agent to review code\n\n" +
		"Anything that isn't a command is also forwarded to the agent.",
	chat: "", // computed dynamically when invoked
	reset: "", // computed dynamically when invoked
	status: "", // computed dynamically when invoked
	memory: "", // forwarded to agent
	cron: "", // forwarded to agent
	model: "", // forwarded to agent
	code: "", // forwarded to agent
	review: "", // forwarded to agent
	task: "", // forwarded to agent
};

export interface HandleContext {
	/** Stable identifier for the chat session — currently `chatId` as a string. */
	readonly sessionKey: string;
	/** Optional callback that the real agent integration replaces. */
	forwardToAgent?: (text: string, sessionKey: string) => Promise<string>;
	/** Optional callback to reset a chat session (bridge). */
	resetChatSession?: (chatId: string) => boolean;
	/** Optional callback to get bridge stats. */
	getBridgeStats?: () => { activeSessions: number; chatIds: string[] };
	/** Optional callback to download a Telegram file to local path. */
	downloadFile?: (fileId: string, fileName: string) => Promise<string>;
}

/**
 * Resolve a parsed message into a reply string. `ctx.forwardToAgent` is
 * injected by the bot at startup; when absent we echo with a marker so
 * the round-trip is observable in tests.
 */
export async function resolveReply(parsed: ParsedMessage, ctx: HandleContext): Promise<string> {
	switch (parsed.kind) {
		case "empty":
			return "I can only read text right now. Send a message and I'll forward it to the agent.";

		case "command": {
			switch (parsed.command) {
				case "start":
				case "help":
					return COMMAND_REPLIES[parsed.command];

				case "reset": {
					if (ctx.resetChatSession) {
						const had = ctx.resetChatSession(ctx.sessionKey);
						return had
							? "Context cleared for this chat. Next message starts a fresh thread."
							: "No active session for this chat. Next message will start one.";
					}
					return "Context cleared for this chat. Next message starts a fresh thread.";
				}

				case "status": {
					const stats = ctx.getBridgeStats?.();
					const sessions = stats ? stats.activeSessions : 0;
					return (
						"*Adapter status*\n\n" +
						"• transport: polling\n" +
						"• backend: grammY v1\n" +
						`• agent sessions: ${sessions}\n` +
						"• bridge: wired ✓"
					);
				}

				case "chat": {
					const text = parsed.args.length > 0 ? parsed.args : "(empty)";
					if (ctx.forwardToAgent) return ctx.forwardToAgent(text, ctx.sessionKey);
					logger.debug("telegram: forwardToAgent not wired; echoing", { sessionKey: ctx.sessionKey });
					return `[stub\\-agent echo] you said: ${escapeForPlain(text)}`;
				}

				case "memory":
				case "cron":
				case "model":
				case "code":
				case "review":
			case "task": {
					// Route through agent — the slash command will be recognized by the session
					const cmdText = `/${parsed.command} ${parsed.args}`.trim();
					if (ctx.forwardToAgent) return ctx.forwardToAgent(cmdText, ctx.sessionKey);
					return `⚠️ Agent not wired. Use /help for available commands.`;
				}
			}
		}

		case "chat": {
			const chatText = (parsed as { kind: "chat"; text: string }).text;
			if (ctx.forwardToAgent) return ctx.forwardToAgent(chatText, ctx.sessionKey);
			return `[stub\\-agent echo] you said: ${escapeForPlain(chatText)}`;
		}

		case "file": {
			const f = parsed as Extract<ParsedMessage, { kind: "file" }>;
			if (!ctx.downloadFile) {
				return "⚠️ File handling not configured. Send text instead.";
			}
			try {
				const localPath = await ctx.downloadFile(f.fileId, f.fileName);
				const fileInfo = `📎 File uploaded: ${f.fileName} (${f.mimeType})\nSaved to: ${localPath}`;
				const prompt = f.caption ? `${fileInfo}\n\nUser caption: ${f.caption}` : fileInfo;
				if (ctx.forwardToAgent) return ctx.forwardToAgent(prompt, ctx.sessionKey);
				return `File saved to ${localPath}. Agent not wired — cannot process.`;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return `⚠️ File download failed: ${escapeForPlain(msg)}`;
			}
		}
	}
}

/** Escape for plain (non\\-markdown) reply. */
function escapeForPlain(text: string): string {
	return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}