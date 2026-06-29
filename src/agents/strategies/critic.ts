/**
 * Critic Strategy — SNS-MyAgent Phase 5.3c
 *
 * Generator agent produces response → Critic agent reviews → Iterate up to max_rounds.
 */

import type { AgentResponse, EnsembleResult, EnsembleStrategy } from "./types.js";
import { aggregateTokens } from "./types.js";

export interface CriticOptions {
  /** Max iteration rounds (default: 2) */
  maxRounds?: number;
}

export class CriticStrategy implements EnsembleStrategy {
  readonly name = "critic";
  readonly #maxRounds: number;

  constructor(options: CriticOptions = {}) {
    this.#maxRounds = options.maxRounds ?? 2;
  }

  async execute(
    prompt: string,
    agents: string[],
    executeAgent: (role: string, prompt: string) => Promise<AgentResponse>,
  ): Promise<EnsembleResult> {
    if (agents.length < 2) {
      throw new Error("Critic strategy requires at least 2 agents: [generator, critic]");
    }

    const [generatorRole, criticRole] = agents;
    const startTime = Date.now();
    let currentPrompt = prompt;
    const allResponses: AgentResponse[] = [];
    let rounds = 0;

    for (let round = 1; round <= this.#maxRounds; round++) {
      rounds = round;

      // Generator produces response
      const genResponse = await executeAgent(generatorRole, currentPrompt);
      allResponses.push(genResponse);

      if (round === this.#maxRounds) {
        // Last round: return generator's final response
        return {
          final: genResponse.content,
          responses: allResponses,
          strategy: this.name,
          rounds,
          totalTimeMs: Date.now() - startTime,
          totalTokens: aggregateTokens(allResponses),
          winner: generatorRole,
        };
      }

      // Critic reviews generator's response
      const criticPrompt = this.#buildCriticPrompt(prompt, genResponse.content);
      const criticResponse = await executeAgent(criticRole, criticPrompt);
      allResponses.push(criticResponse);

      // Check if critic is satisfied (score >= 0.7 or explicit "approved")
      const satisfied = this.#isSatisfied(criticResponse);
      if (satisfied) {
        return {
          final: genResponse.content,
          responses: allResponses,
          strategy: this.name,
          rounds,
          totalTimeMs: Date.now() - startTime,
          totalTokens: aggregateTokens(allResponses),
          winner: generatorRole,
        };
      }

      // Next iteration: improve based on critic feedback
      currentPrompt = this.#buildImprovementPrompt(prompt, genResponse.content, criticResponse.content);
    }

    // Max rounds reached, return last generator response
    const finalGenResponse = allResponses[allResponses.length - 2]!;
    return {
      final: finalGenResponse.content,
      responses: allResponses,
      strategy: this.name,
      rounds,
      totalTimeMs: Date.now() - startTime,
      totalTokens: aggregateTokens(allResponses),
      winner: generatorRole,
    };
  }

  #buildCriticPrompt(originalPrompt: string, response: string): string {
    return `Original task: ${originalPrompt}

Candidate response:
${response}

Critique this response. Provide:
1. Score 0-1 (1 = excellent, 0 = poor)
2. Specific issues/weaknesses
3. Suggested improvements
4. Verdict: "APPROVED" if score >= 0.7, otherwise "NEEDS IMPROVEMENT"

Format:
SCORE: <number>
ISSUES: <list>
IMPROVEMENTS: <list>
VERDICT: <APPROVED|NEEDS IMPROVEMENT>`;
  }

  #isSatisfied(criticResponse: AgentResponse): boolean {
    const content = criticResponse.content.toUpperCase();
    if (content.includes("APPROVED")) return true;
    if (criticResponse.score !== undefined && criticResponse.score >= 0.7) return true;
    return false;
  }

  #buildImprovementPrompt(originalPrompt: string, lastResponse: string, criticFeedback: string): string {
    return `Original task: ${originalPrompt}

Previous attempt:
${lastResponse}

Critic feedback:
${criticFeedback}

Produce an IMPROVED response addressing all issues raised. Do not repeat the same mistakes.`;
  }
}