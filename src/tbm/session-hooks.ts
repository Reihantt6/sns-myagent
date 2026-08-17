/**
 * TBM session hooks — the pure functions the real agent loop calls each turn.
 *
 * These are deliberately free of any session/UI/IO dependency so they can be
 * driven with real `AgentMessage` shapes in tests and still produce observable
 * effects on the outbound model payload. `AgentSession`/`sdk.ts` call them at:
 *
 *   pre-model  → applyTbmPreModel         (comm-mode directive, tombstone,
 *                                           context-delta accounting, pyramid,
 *                                           lazy skills)
 *   post-tool  → applyTbmToolCompression   (compress oversized tool output)
 *   post-turn  → cacheTbmResponse          (response-cache store)
 *
 * When `tbm.enabled` is false every function is a pass-through, so the existing
 * loop is byte-for-byte unchanged until a user opts in via `tbm.enabled`.
 */

import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { TbmManager } from "./index";

/** A message whose content is plain text and safe to tombstone. */
interface PlainTextMessage {
	index: number;
	role: "user" | "assistant";
	content: string;
}

type TextBlock = { type: "text"; text: string };

function isTextBlock(block: unknown): block is TextBlock {
	return (
		typeof block === "object" &&
		block !== null &&
		(block as { type?: unknown }).type === "text" &&
		typeof (block as { text?: unknown }).text === "string"
	);
}

/** Extract plain-text content from a user/assistant message, or undefined when
 *  it carries tool calls / images / thinking blocks (unsafe to tombstone). */
function plainTextOf(message: AgentMessage): string | undefined {
	if (message.role !== "user" && message.role !== "assistant") return undefined;
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return undefined;
	if (content.length === 0) return undefined;
	const texts = content.filter(isTextBlock);
	// Only tombstone messages that are entirely text (no toolCall/image/thinking).
	if (texts.length !== content.length) return undefined;
	return texts.map(block => block.text).join("\n");
}

/** Replace a message's content with a tombstone line, preserving role + shape. */
function withTextContent(message: AgentMessage, text: string): AgentMessage {
	return { ...message, content: [{ type: "text", text }] } as AgentMessage;
}

/** Build a developer message carrying the comm-mode directive. */
function directiveMessage(directive: string): AgentMessage {
	return {
		role: "developer",
		content: [{ type: "text", text: directive }],
		timestamp: Date.now(),
	} as AgentMessage;
}

function lastUserText(messages: AgentMessage[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const text = plainTextOf(messages[i]);
		if (messages[i].role === "user" && text !== undefined) return text;
	}
	return "";
}

/** Serialize messages for context-delta accounting. Structure is irrelevant to
 *  the delta cache (it only hashes a static vs dynamic split), so a lossy text
 *  join is sufficient — this never becomes the on-wire payload. */
function serializeForDelta(messages: AgentMessage[]): string {
	return messages
		.map(message => {
			const text = plainTextOf(message);
			if (text !== undefined) return `${message.role}: ${text}`;
			return `${message.role}: [structured]`;
		})
		.join("\n");
}

/**
 * Pre-model hook. Drives the comm-mode / pyramid / context-delta / lazy-skills
 * subsystems, tombstones old plain-text messages, and injects the comm-mode
 * directive. Returns the (possibly transformed) messages.
 */
export function applyTbmPreModel(tbm: TbmManager | undefined, messages: AgentMessage[]): AgentMessage[] {
	if (!tbm || !tbm.enabled) return messages;

	const userText = lastUserText(messages);
	const directive = tbm.commMode.resolveForMessage(userText).directive;

	if (tbm.config.pyramid.enabled) {
		tbm.pyramid.setLevel(tbm.pyramid.resolveLevel(userText));
	}

	if (tbm.config.context_delta.enabled) {
		tbm.contextDelta.processTurn(serializeForDelta(messages));
	}

	if (tbm.config.lazy_skills.enabled && tbm.lazySkills.stats.totalAvailable > 0) {
		tbm.lazySkills.processMessage(userText, tbm.config.lazy_skills.max_per_turn);
	}

	let out = messages;
	if (tbm.config.tombstone.enabled) {
		out = applyTombstone(tbm, out);
	}

	if (directive) {
		out = [directiveMessage(directive), ...out];
	}

	return out;
}

/**
 * Tombstone old plain-text messages in place. Only messages that are entirely
 * text are eligible — tool calls/results, images, and thinking blocks are left
 * untouched so tool-call ↔ tool-result pairing survives. A tombstoned original
 * never re-enters the active context (its content is replaced by a summary).
 */
export function applyTombstone(tbm: TbmManager, messages: AgentMessage[]): AgentMessage[] {
	const eligible: PlainTextMessage[] = [];
	for (let i = 0; i < messages.length; i++) {
		const text = plainTextOf(messages[i]);
		if (text !== undefined) {
			eligible.push({ index: i, role: messages[i].role as "user" | "assistant", content: text });
		}
	}

	if (eligible.length === 0) return messages;

	const result = tbm.tombstoneMessages(eligible.map(entry => ({ role: entry.role, content: entry.content })));
	if (result.tombstoned === 0) return messages;

	const out = [...messages];
	for (let i = 0; i < result.compressed.length; i++) {
		const entry = eligible[i];
		if (!entry) break;
		out[entry.index] = withTextContent(out[entry.index], result.compressed[i].content);
	}
	return out;
}

/**
 * Post-tool hook. Compress a tool result's text content to its configured
 * budget. Returns the (possibly replaced) content array, or undefined when
 * nothing changed (so the caller keeps the original).
 */
export function applyTbmToolCompression(
	tbm: TbmManager | undefined,
	toolName: string,
	content: readonly unknown[],
): unknown[] | undefined {
	if (!tbm || !tbm.enabled || !tbm.config.compress.enabled) return undefined;

	let changed = false;
	const out = content.map(block => {
		if (!isTextBlock(block)) return block;
		const { output, compressed } = tbm.compressToolOutput(toolName, block.text);
		if (!compressed) return block;
		changed = true;
		return { ...block, text: output };
	});

	return changed ? out : undefined;
}

/**
 * Post-turn hook. Store the (query → response) pair in the response cache.
 * A cache hit is *not* used to short-circuit the model call today — the
 * structured loop cannot safely skip a turn here, so this is store-only.
 */
export function cacheTbmResponse(tbm: TbmManager | undefined, query: string, response: string): void {
	if (!tbm || !tbm.enabled) return;
	if (!query || !response) return;
	tbm.cacheResponse(query, response);
}

/** Extract the last user query and last assistant reply from a finished turn's
 *  messages, and cache the pair. Called from the agent loop's onTurnEnd hook. */
export function cacheTbmTurnResponse(tbm: TbmManager | undefined, messages: readonly AgentMessage[]): void {
	if (!tbm || !tbm.enabled) return;
	let query = "";
	let response = "";
	for (const message of messages) {
		const text = plainTextOf(message);
		if (text === undefined) continue;
		if (message.role === "user") query = text;
		else if (message.role === "assistant") response = text;
	}
	cacheTbmResponse(tbm, query, response);
}
