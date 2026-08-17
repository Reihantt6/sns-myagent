import { describe, expect, test } from "bun:test";
import { Agent } from "@oh-my-pi/pi-agent-core";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage, Context } from "@oh-my-pi/pi-ai";
import { TbmManager } from "../index";
import { composeTransformContext } from "../session-hooks";

/**
 * Drives the REAL pi-agent-core agent loop (`Agent.prompt`) with a mock model
 * stream, so the only mocked piece is the provider transport. The pre-LLM
 * transform is wired through `composeTransformContext` — the exact function
 * `createAgentSession` (src/sdk.ts) passes to the session. If the TBM step is
 * removed from that seam, these tests fail (regression-proof wiring).
 */

const mockModel = {
	id: "mock-model",
	name: "Mock Model",
	api: "anthropic",
	provider: "mock",
	baseUrl: "http://mock.invalid",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 200_000,
	maxTokens: 4096,
};

function assistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic",
		provider: "mock",
		model: "mock-model",
		timestamp: Date.now(),
	} as unknown as AssistantMessage;
}

function userMessage(text: string, timestamp = 1): AgentMessage {
	return { role: "user", content: text, timestamp } as unknown as AgentMessage;
}

/** Extract the text of a provider message (string or block array). */
function textOf(message: { content?: unknown }): string {
	const content = message.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map((b: { text?: string }) => b.text ?? "").join("\n");
	return "";
}

async function runTurn(tbm: TbmManager, history: AgentMessage[], prompt: string): Promise<Context> {
	const captured: Context[] = [];
	const streamFn = async function* (_model: unknown, context: Context) {
		captured.push(context);
		yield { type: "done", reason: "stop", message: assistantMessage("done") };
	};

	const agent = new Agent({
		initialState: {
			systemPrompt: ["base system prompt"],
			model: mockModel as never,
			tools: [],
			messages: history.slice(),
		},
		// The exact seam createAgentSession uses: emitContext → applyTbmPreModel → wrapSteering.
		transformContext: composeTransformContext({
			tbm,
			emitContext: async messages => messages,
			wrapSteering: messages => messages,
		}),
		convertToLlm: async messages => messages as never,
		streamFn: streamFn as never,
	});

	await agent.prompt(prompt);
	return captured[0];
}

describe("TBM real agent-loop integration (regression-proof)", () => {
	test("comm-mode directive appears in the model-request payload", async () => {
		const tbm = new TbmManager({ enabled: true, comm_mode: "caveman", tombstone: { enabled: false } });
		const context = await runTurn(tbm, [], "fix the auth bug");

		const texts = context.messages.map(textOf);
		// The caveman directive is injected as a leading developer message.
		expect(context.messages[0]).toBeDefined();
		expect(texts.join("\n")).toContain("caveman");
		// TBM accounting advanced (a real turn ran through the pre-model hook).
		expect(tbm.contextDelta.stats.turns).toBe(1);
	});

	test("tombstone replaces old messages; originals do not re-enter the payload", async () => {
		const tbm = new TbmManager({
			enabled: true,
			tombstone: { enabled: true, after_turns: 1, keep_recent: 1 },
		});
		const longOriginal = "very long original user message " + "detail ".repeat(40);
		const history = [
			userMessage(longOriginal, 1),
			{ role: "assistant", content: [{ type: "text", text: "long assistant reply ".repeat(30) }], timestamp: 2 } as unknown as AgentMessage,
			userMessage("recent message", 3),
		];
		const context = await runTurn(tbm, history, "continue");

		const texts = context.messages.map(textOf);
		// The truncated original must not be present verbatim in the payload.
		expect(texts.join("\n")).not.toContain(longOriginal);
		// A tombstone line replaced it.
		expect(texts.some(t => /^\[Turn \d+ - user\]/.test(t.trim()))).toBe(true);
		// Tombstone stats advanced.
		expect(tbm.tombstoner.stats.messagesTombstoned).toBeGreaterThan(0);
	});

	test("lazy skills: only the referenced skill is loaded and its content reaches the payload", async () => {
		const tbm = new TbmManager({
			enabled: true,
			lazy_skills: { enabled: true, max_per_turn: 3 },
			tombstone: { enabled: false },
		});
		tbm.registerSkills([
			{ name: "git-workflow", description: "branch merge rebase workflows", fullContent: "FULL GIT WORKFLOW CONTENT " + "step ".repeat(30), tokens: 500 },
			{ name: "sql-tuning", description: "index query explain plan tuning", fullContent: "FULL SQL TUNING CONTENT " + "step ".repeat(30), tokens: 500 },
		]);
		const context = await runTurn(tbm, [], "help me with git-workflow rebase");

		const payload = context.messages.map(textOf).join("\n");
		// The referenced skill's full content is injected into the payload…
		expect(payload).toContain("FULL GIT WORKFLOW CONTENT");
		// …while the unreferenced skill is never loaded.
		expect(payload).not.toContain("FULL SQL TUNING CONTENT");
		expect(tbm.lazySkills.isLoaded("git-workflow")).toBe(true);
		expect(tbm.lazySkills.isLoaded("sql-tuning")).toBe(false);
		expect(tbm.lazySkills.stats.loadedOnDemand).toBe(1);
	});

	test("disabled TBM leaves the payload identical (safe default)", async () => {
		const tbm = new TbmManager({ enabled: false });
		const history = [userMessage("hello there", 1)];
		const context = await runTurn(tbm, history, "hello there");

		// No developer directive or skill section is injected.
		const roles = context.messages.map((m: { role?: string }) => m.role);
		expect(roles.some(r => r === "developer")).toBe(false);
		// No TBM accounting happens.
		expect(tbm.contextDelta.stats.turns).toBe(0);
		expect(tbm.tombstoner.stats.messagesTombstoned).toBe(0);
		expect(tbm.lazySkills.stats.loadedOnDemand).toBe(0);
	});
});
