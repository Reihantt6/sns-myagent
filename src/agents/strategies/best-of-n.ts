/**
 * Best-of-N Strategy — SNS-MyAgent Phase 5.3d
 *
 * Generate N candidates from same agent/role → Rank by scoring agent → Pick best.
 */

import type { AgentResponse, EnsembleResult, EnsembleStrategy } from "./types.js";
import { aggregateTokens } from "./types.js";

export interface BestOfNOptions {
  /** Number of candidates to generate (default: 4) */
  n?: number;
  /** Scorer agent role (default: same as first agent) */
  scorerRole?: string;
}

export class BestOfNStrategy implements EnsembleStrategy {
  readonly name = "best_of_n";
  readonly #n: number;
  readonly #scorerRole?: string;

  constructor(options: BestOfNOptions = {}) {
    this.#n = options.n ?? 4;
    this.#scorerRole = options.scorerRole;
  }

  async execute(
    prompt: string,
    agents: string[],
    executeAgent: (role: string, prompt: string) => Promise<AgentResponse>,
  ): Promise<EnsembleResult> {
    if (agents.length === 0) {
      throw new Error("Best-of-N requires at least 1 agent");
    }

    const generatorRole = agents[0];
    const scorerRole = this.#scorerRole ?? generatorRole;
    const startTime = Date.now();
    const allResponses: AgentResponse[] = [];

    // Generate N candidates in parallel
    const candidates = await Promise.all(
      Array.from({ length: this.#n }, (_, i) =>
        executeAgent(generatorRole, `${prompt}\n\n[Candidate ${i + 1}/${this.#n}]`),
      ),
    );
    allResponses.push(...candidates);

    // Score each candidate
    const scoredCandidates = await this.#scoreCandidates(candidates, scorerRole, executeAgent, prompt);
    allResponses.push(...scoredCandidates.scores);

    // Pick highest scored
    const bestIdx = scoredCandidates.ranking[0];
    const winner = candidates[bestIdx];

    return {
      final: winner.content,
      responses: allResponses,
      strategy: this.name,
      rounds: 2,
      totalTimeMs: Date.now() - startTime,
      totalTokens: aggregateTokens(allResponses),
      winner: generatorRole,
    };
  }

  async #scoreCandidates(
    candidates: AgentResponse[],
    scorerRole: string,
    executeAgent: (role: string, prompt: string) => Promise<AgentResponse>,
    originalPrompt: string,
  ): Promise<{ scores: AgentResponse[]; ranking: number[] }> {
    const scores: AgentResponse[] = [];
    const ranking = Array.from({ length: candidates.length }, (_, i) => i);

    for (let i = 0; i < candidates.length; i++) {
      const scorePrompt = this.#buildScorePrompt(originalPrompt, candidates[i].content);
      const scoreResponse = await executeAgent(scorerRole, scorePrompt);
      scores.push(scoreResponse);
      candidates[i].score = this.#extractScore(scoreResponse);
    }

    // Sort by score descending
    ranking.sort((a, b) => (candidates[b].score ?? 0) - (candidates[a].score ?? 0));

    return { scores, ranking };
  }

  #buildScorePrompt(originalPrompt: string, candidate: string): string {
    return `Original task: ${originalPrompt}

Candidate response to evaluate:
${candidate}

Rate this response 0-1 on: correctness, completeness, clarity, relevance.
Output format:
SCORE: <0-1>
REASONING: <brief>`;
  }

  #extractScore(scoreResponse: AgentResponse): number {
    const match = scoreResponse.content.match(/SCORE:\s*([0-9]*\.?[0-9]+)/i);
    if (match) return Math.min(1, Math.max(0, Number.parseFloat(match[1])));
    if (scoreResponse.score !== undefined) return scoreResponse.score;
    return 0.5;
  }
}