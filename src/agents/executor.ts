/**
 * Ensemble Agent Executor — SNS-MyAgent Phase 5.1d
 *
 * Bridges the ensemble orchestrator (src/agents/ensemble.ts) to the
 * actual LLM execution (src/task/executor.ts).
 *
 * Provides `executeAgentForEnsemble(role, prompt) → AgentResponse`
 * which resolves agent config from agents.yaml, builds an AgentDefinition,
 * calls runSubprocess, and returns the typed response.
 */

import { randomBytes } from "node:crypto";
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import { getAgentsConfig, type AgentRoleConfig } from "./config.js";
import { runSubprocess, type ExecutorOptions } from "../task/executor.js";
import type { AgentDefinition, SingleResult } from "../task/types.js";
import type { AgentResponse } from "./strategies/types.js";

// ─── Default agent definition ───────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Answer the user's request directly and concisely.
Do not use any tools. Do not spawn subagents. Just answer.`;

const DEFAULT_AGENT: AgentDefinition = {
  name: "task",
  description: "General-purpose agent for ensemble tasks",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  source: "bundled",
};

// ─── Executor ───────────────────────────────────────────────────────────────

/**
 * Execute a single agent call for the ensemble orchestrator.
 *
 * @param role  - Agent role name (from agents.yaml or "task")
 * @param prompt - The user prompt to send
 * @returns AgentResponse compatible with ensemble strategies
 */
export async function executeAgentForEnsemble(
  role: string,
  prompt: string,
): Promise<AgentResponse> {
  const startTime = Date.now();
  const config = getAgentsConfig();
  const roleConfig = config.resolveRole(role);

  // Build AgentDefinition from config (or use default)
  const agentDef = buildAgentDefinition(role, roleConfig);

  // Resolve model string for display
  const modelStr = roleConfig?.model ?? "default";

  // Generate unique ID for this execution
  const execId = `ensemble-${role}-${randomBytes(4).toString("hex")}`;

  // Build executor options
  const cwd = process.cwd();
  const options: ExecutorOptions = {
    cwd,
    agent: agentDef,
    task: prompt,
    index: 0,
    id: execId,
    role,
    // Use model override from agents.yaml if specified
    modelOverride: roleConfig?.model,
    thinkingLevel: resolveThinkingLevel(roleConfig?.thinking_level),
  };

  try {
    const result: SingleResult = await runSubprocess(options);

    return {
      role,
      model: result.resolvedModel ?? modelStr,
      content: result.output || result.error || "(no output)",
      tokens: result.usage
        ? { input: result.usage.input ?? 0, output: result.usage.output ?? 0 }
        : undefined,
      timeMs: Date.now() - startTime,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      role,
      model: modelStr,
      content: `[executor error] ${msg}`,
      timeMs: Date.now() - startTime,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildAgentDefinition(
  role: string,
  roleConfig: AgentRoleConfig | null,
): AgentDefinition {
  return {
    name: role,
    description: roleConfig?.system_prompt
      ? `Custom agent: ${role}`
      : `Ensemble agent: ${role}`,
    systemPrompt: roleConfig?.system_prompt ?? DEFAULT_SYSTEM_PROMPT,
    tools: roleConfig?.tools,
    source: roleConfig ? "user" : "bundled",
  };
}

/**
 * Map a string thinking_level from agents.yaml to the actual ThinkingLevel const.
 * Returns undefined if not set or unrecognized.
 */
function resolveThinkingLevel(
  level: string | undefined,
): ThinkingLevel | undefined {
  if (!level) return undefined;
  const map: Record<string, ThinkingLevel> = {
    inherit: "inherit" as ThinkingLevel,
    off: "off" as ThinkingLevel,
    minimal: "minimal" as ThinkingLevel,
    low: "low" as ThinkingLevel,
    medium: "medium" as ThinkingLevel,
    high: "high" as ThinkingLevel,
    xhigh: "xhigh" as ThinkingLevel,
  };
  return map[level.toLowerCase()] ?? undefined;
}
