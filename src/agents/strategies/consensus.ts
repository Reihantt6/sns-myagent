/**
 * Consensus Strategy — SNS-MyAgent Phase 5.3b
 *
 * Spawn N agents with same prompt → Pick majority/best answer.
 */

import type { AgentResponse, EnsembleResult, EnsembleStrategy } from "./types.js";
import { aggregateTokens } from "./types.js";

export interface ConsensusOptions {
  /** Number of agents to spawn (default: 3) */
  n?: number;
  /** Consensus threshold 0-1 (default: 0.6) */
  threshold?: number;
  /** Comparison function: "exact" | "semantic" (default: "exact") */
  compareMode?: "exact" | "semantic";
}

export class ConsensusStrategy implements EnsembleStrategy {
  readonly name = "consensus";
  readonly #n: number;
  readonly #threshold: number;
  readonly #compareMode: "exact" | "semantic";

  constructor(options: ConsensusOptions = {}) {
    this.#n = options.n ?? 3;
    this.#threshold = options.threshold ?? 0.6;
    this.#compareMode = options.compareMode ?? "exact";
  }

  async execute(
    prompt: string,
    agents: string[],
    executeAgent: (role: string, prompt: string) => Promise<AgentResponse>,
  ): Promise<EnsembleResult> {
    if (agents.length === 0) {
      throw new Error("Consensus requires at least 1 agent");
    }

    const startTime = Date.now();
    const allResponses: AgentResponse[] = [];

    // Spawn N agents in parallel (cycle through available agents)
    const candidates = await Promise.all(
      Array.from({ length: this.#n }, async (_, i) => {
        const role = agents[i % agents.length];
        const response = await executeAgent(role, `${prompt}\n\n[Consensus attempt ${i + 1}/${this.#n}]`);
        allResponses.push(response);
        return response;
      }),
    );

    // Find consensus
    const { winner, agreement } = this.#findConsensus(candidates);

    return {
      final: winner.content,
      responses: allResponses,
      strategy: this.name,
      rounds: 1,
      totalTimeMs: Date.now() - startTime,
      totalTokens: aggregateTokens(allResponses),
      winner: winner.role,
      metadata: { agreement, threshold: this.#threshold, met: agreement >= this.#threshold },
    };
  }

  #findConsensus(candidates: AgentResponse[]): { winner: AgentResponse; agreement: number } {
    if (candidates.length === 1) return { winner: candidates[0], agreement: 1 };

    // Group similar responses
    const groups: AgentResponse[][] = [];

    for (const candidate of candidates) {
      let placed = false;
      for (const group of groups) {
        if (this.#similar(candidate.content, group[0].content)) {
          group.push(candidate);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([candidate]);
    }

    // Pick largest group
    groups.sort((a, b) => b.length - a.length);
    const bestGroup = groups[0];
    const agreement = bestGroup.length / candidates.length;

    // Winner = first in best group
    return { winner: bestGroup[0], agreement };
  }

  #similar(a: string, b: string): boolean {
    if (this.#compareMode === "exact") return a.trim() === b.trim();

    // Simple semantic: Jaccard similarity on words
    const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union >= 0.7 : false;
  }
}