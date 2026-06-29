/**
 * Ensemble strategy smoke tests — SNS-MyAgent Phase 5
 *
 * Pure logic tests (no DB, no LLM). Verifies deterministic
 * consensus/critic/best-of-N behavior with mock executors.
 */

import { describe, it, expect } from "bun:test";
import { ConsensusStrategy } from "../strategies/consensus.js";
import { BestOfNStrategy } from "../strategies/best-of-n.js";
import { CriticStrategy } from "../strategies/critic.js";
import { aggregateTokens } from "../strategies/types.js";
import type { AgentResponse } from "../strategies/types.js";

function mockResp(role: string, content: string, tokens = { input: 10, output: 20 }): AgentResponse {
	return { role, model: "test", content, tokens, timeMs: 5 };
}

describe("aggregateTokens", () => {
	it("sums input/output across responses", () => {
		const out = aggregateTokens([
			mockResp("a", "x", { input: 5, output: 7 }),
			mockResp("b", "y", { input: 3, output: 2 }),
		]);
		expect(out).toEqual({ input: 8, output: 9 });
	});

	it("treats missing tokens as zero", () => {
		const out = aggregateTokens([{ role: "x", model: "m", content: "c", timeMs: 0 }]);
		expect(out).toEqual({ input: 0, output: 0 });
	});
});

describe("ConsensusStrategy", () => {
	it("picks majority when threshold met", async () => {
		const strat = new ConsensusStrategy({ n: 3, threshold: 0.5 });
		const exec = async (role: string) => mockResp(role, role === "a" ? "YES" : "NO");
		const result = await strat.execute("q?", ["a", "b"], exec);
		expect(result.strategy).toBe("consensus");
		expect(result.responses.length).toBe(3);
		expect(["YES", "NO"]).toContain(result.final);
	});

	it("throws when no agents provided", async () => {
		const strat = new ConsensusStrategy();
		await expect(strat.execute("q?", [], async () => mockResp("x", "x"))).rejects.toThrow(
			/at least 1 agent/,
		);
	});
});

describe("BestOfNStrategy", () => {
	it("executes and returns a ranked result", async () => {
		const strat = new BestOfNStrategy({ n: 2 });
		const exec = async (role: string, prompt: string) => {
			// Scorer prompt format → respond with a number
			if (prompt.includes("Rate")) return mockResp(role, "0.8");
			return mockResp(role, `out-${role}`);
		};
		const result = await strat.execute("q?", ["a", "b"], exec);
		expect(result.strategy).toBe("best_of_n");
		expect(result.responses.length).toBeGreaterThan(0);
		expect(result.final).toMatch(/out-[ab]/);
	});
});

describe("CriticStrategy", () => {
	it("iterates generator→critic until accept or max rounds", async () => {
		const strat = new CriticStrategy({ maxRounds: 2 });
		let round = 0;
		const exec = async (_role: string, prompt: string) => {
			round++;
			if (prompt.includes("[critic review")) {
				return mockResp("critic", "accepted", { input: 5, output: 10 });
			}
			return mockResp("gen", `draft-v${round}`, { input: 1, output: 5 });
		};
		const result = await strat.execute("write essay", ["gen", "critic"], exec);
		expect(result.strategy).toBe("critic");
		expect(result.rounds).toBeGreaterThanOrEqual(1);
		expect(result.final).toContain("draft");
	});
});