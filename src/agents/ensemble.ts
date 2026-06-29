/**
 * Ensemble Orchestrator — SNS-MyAgent Phase 5.3e
 *
 * Main entry point for multi-agent ensemble execution.
 * Loads agents.yaml config, resolves strategy, executes with resilience.
 */

import { getAgentsConfig } from "./config.js";
import * as resilience from "./resilience.js";
import type { AgentRoleConfig } from "./config.js";
import type { AgentResponse, EnsembleResult, EnsembleStrategy } from "./strategies/types.js";
import { ConsensusStrategy } from "./strategies/consensus.js";
import { CriticStrategy } from "./strategies/critic.js";
import { BestOfNStrategy } from "./strategies/best-of-n.js";

export interface EnsembleOptions {
  /** Ensemble name from agents.yaml, or strategy name inline */
  ensemble?: string;
  /** Inline strategy override: "consensus" | "critic" | "best_of_n" */
  strategy?: "consensus" | "critic" | "best_of_n";
  /** Agent roles to use (overrides ensemble config) */
  agents?: string[];
  /** Strategy-specific options */
  strategyOptions?: Record<string, unknown>;
  /** Override max concurrency */
  maxConcurrency?: number;
  /** Override task timeout (ms) */
  taskTimeoutMs?: number;
  /** Enable resilience (retry/timeout/circuit-breaker) */
  resilient?: boolean;
}

export interface EnsembleExecutionResult extends EnsembleResult {
  configUsed: {
    ensemble?: string;
    strategy: string;
    agents: string[];
  };
  costBreakdown: Array<{ role: string; model: string; inputTokens: number; outputTokens: number; costUsd?: number }>;
}

/**
 * Execute an ensemble task.
 *
 * @param prompt - User prompt/task description
 * @param executeAgent - Function to spawn an agent and get response
 * @param options - Ensemble configuration
 * @returns Ensemble result with cost breakdown
 */
export async function executeEnsemble(
  prompt: string,
  executeAgent: (role: string, prompt: string) => Promise<AgentResponse>,
  options: EnsembleOptions = {},
): Promise<EnsembleExecutionResult> {
  const config = getAgentsConfig().config;

  // Resolve ensemble/strategy/agents
  const { strategyName, agentRoles, strategyOpts } = resolveEnsembleConfig(config, options);

  // Get strategy instance
  const strategy = createStrategy(strategyName, strategyOpts);

  // Execute with resilience if enabled
  const executeWithResilience = options.resilient !== false
    ? createResilientExecutor(config, options)
    : executeAgent;

  const result = await strategy.execute(prompt, agentRoles, executeWithResilience);

  // Build cost breakdown
  const costBreakdown = buildCostBreakdown(result, agentRoles, config);

  return {
    ...result,
    configUsed: {
      ensemble: options.ensemble,
      strategy: strategyName,
      agents: agentRoles,
    },
    costBreakdown,
  };
}

function resolveEnsembleConfig(
  config: ReturnType<typeof getAgentsConfig>["config"],
  options: EnsembleOptions,
): { strategyName: string; agentRoles: string[]; strategyOpts: Record<string, unknown> } {
  // 1. Explicit ensemble name from agents.yaml
  if (options.ensemble) {
    const ensemble = config.ensembles?.[options.ensemble];
    if (!ensemble) throw new Error(`Ensemble "${options.ensemble}" not found in agents.yaml`);
    return {
      strategyName: ensemble.strategy,
      agentRoles: options.agents ?? ensemble.agents ?? [],
      strategyOpts: { ...ensemble, ...options.strategyOptions },
    };
  }

  // 2. Inline strategy
  if (options.strategy) {
    return {
      strategyName: options.strategy,
      agentRoles: options.agents ?? (config.default_agent ? [config.default_agent] : []),
      strategyOpts: options.strategyOptions ?? {},
    };
  }

  // 3. Default: single agent (no ensemble)
  const defaultAgent = config.default_agent ?? "task";
  return {
    strategyName: "single",
    agentRoles: options.agents ?? [defaultAgent],
    strategyOpts: {},
  };
}

function createStrategy(name: string, options: Record<string, unknown>): EnsembleStrategy {
  switch (name) {
    case "consensus":
      return new ConsensusStrategy(options);
    case "critic":
      return new CriticStrategy(options);
    case "best_of_n":
      return new BestOfNStrategy(options);
    case "single":
      // Single agent fallback
      return {
        name: "single",
        async execute(prompt, agents, executeAgent) {
          const response = await executeAgent(agents[0], prompt);
          return {
            final: response.content,
            responses: [response],
            strategy: "single",
            rounds: 1,
            totalTimeMs: response.timeMs,
            totalTokens: response.tokens ?? { input: 0, output: 0 },
            winner: agents[0],
          };
        },
      };
    default:
      throw new Error(`Unknown ensemble strategy: ${name}`);
  }
}

function createResilientExecutor(
  config: ReturnType<typeof getAgentsConfig>["config"],
  options: EnsembleOptions,
) {
  return async (role: string, prompt: string): Promise<AgentResponse> => {
    const agentConfig = config.agents[role];
    const modelKey = agentConfig?.model ?? "default";

    const breaker = resilience.getCircuitBreaker(modelKey);

    return resilience.withRetry(
      async () => {
        return resilience.withTimeout(
          async () => {
            // This will be replaced by actual agent execution via the wrapper
            throw new Error("executeAgent must be provided by caller");
          },
          options.taskTimeoutMs ?? config.task_timeout_ms ?? 120_000,
          `ensemble:${role}`,
        );
      },
      {
        maxAttempts: config.retry_attempts ?? 3,
        baseDelayMs: 1000,
      },
    );
  };
}

function buildCostBreakdown(
  result: EnsembleResult,
  agentRoles: string[],
  config: ReturnType<typeof getAgentsConfig>["config"],
): EnsembleExecutionResult["costBreakdown"] {
  const breakdown: EnsembleExecutionResult["costBreakdown"] = [];

  for (const response of result.responses) {
    const role = response.role;
    const agentConfig = config.agents[role] as AgentRoleConfig | undefined;

    breakdown.push({
      role,
      model: agentConfig?.model ?? "unknown",
      inputTokens: response.tokens?.input ?? 0,
      outputTokens: response.tokens?.output ?? 0,
      // costUsd: calculateCost(agentConfig?.model, response.tokens), // TODO: add pricing
    });
  }

  return breakdown;
}

/**
 * Execute a simple single-agent task with resilience.
 * Convenience wrapper for non-ensemble usage.
 */
export async function executeAgentTask(
  role: string,
  prompt: string,
  executeAgent: (role: string, prompt: string) => Promise<AgentResponse>,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<AgentResponse> {
  const config = getAgentsConfig().config;
  const timeoutMs = options.timeoutMs ?? config.task_timeout_ms ?? 120_000;
  const retries = options.retries ?? config.retry_attempts ?? 3;

  return resilience.withRetry(
    async () => resilience.withTimeout(
      () => executeAgent(role, prompt),
      timeoutMs,
      `agent:${role}`,
    ),
    { maxAttempts: retries },
  );
}

export { getAgentsConfig } from "./config.js";
export { ConsensusStrategy, CriticStrategy, BestOfNStrategy } from "./strategies/index.js";