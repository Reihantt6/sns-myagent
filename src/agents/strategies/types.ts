/**
 * Ensemble base types — SNS-MyAgent Phase 5.3
 *
 * Shared types for consensus, critic, and best-of-N strategies.
 */

export interface AgentResponse {
  /** Agent role that produced this */
  role: string;
  /** Model used */
  model: string;
  /** Response text */
  content: string;
  /** Token usage */
  tokens?: { input: number; output: number };
  /** Time taken in ms */
  timeMs: number;
  /** Quality score 0-1 (assigned by judge/critic) */
  score?: number;
}

export interface EnsembleResult {
  /** Final selected/merged response */
  final: string;
  /** All individual responses */
  responses: AgentResponse[];
  /** Strategy used */
  strategy: string;
  /** Total rounds executed */
  rounds: number;
  /** Total time in ms */
  totalTimeMs: number;
  /** Total tokens across all agents */
  totalTokens: { input: number; output: number };
  /** Agent that won/produced the final (for best_of_n/consensus) */
  winner?: string;
}

export interface EnsembleStrategy {
  /** Strategy name */
  readonly name: string;
  /**
   * Execute the ensemble strategy.
   *
   * @param prompt - The user prompt to send to all agents
   * @param agents - Available agent role configs
   * @param executeAgent - Function to spawn an agent and get its response
   * @returns Final ensemble result
   */
  execute(
    prompt: string,
    agents: string[],
    executeAgent: (role: string, prompt: string) => Promise<AgentResponse>,
  ): Promise<EnsembleResult>;
}

/**
 * Aggregate token usage across responses.
 */
export function aggregateTokens(responses: AgentResponse[]): { input: number; output: number } {
  return responses.reduce(
    (acc, r) => ({
      input: acc.input + (r.tokens?.input ?? 0),
      output: acc.output + (r.tokens?.output ?? 0),
    }),
    { input: 0, output: 0 },
  );
}
