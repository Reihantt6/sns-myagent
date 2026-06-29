/**
 * agents.yaml config system — SNS-MyAgent Phase 5.2
 *
 * Parses custom agent roles from ~/.sns-myagent/agents.yaml (user-level)
 * or ./.sns-myagent/agents.yaml (project-level).
 *
 * Falls back to bundled Pi agents when no custom config exists.
 * Hot-reloads on file change via fs.watch.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { EventEmitter } from "node:events";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentRoleConfig {
  /** Model to use (e.g. "claude-sonnet", "gpt-4o", "perplexity") */
  model: string;
  /** Provider (e.g. "anthropic", "openai", "custom") */
  provider?: string;
  /** Tools this agent can use */
  tools?: string[];
  /** Custom system prompt override */
  system_prompt?: string;
  /** Thinking level: low | medium | high | max */
  thinking_level?: string;
  /** Max tokens for output */
  max_tokens?: number;
  /** Temperature override */
  temperature?: number;
}

export interface EnsembleConfig {
  /** Strategy: consensus | critic | best_of_n */
  strategy: "consensus" | "critic" | "best_of_n";
  /** For consensus/best_of_n: list of agent roles to spawn */
  agents?: string[];
  /** For critic: generator agent */
  generator?: string;
  /** For critic: critic agent */
  critic?: string;
  /** Max iteration rounds (critic strategy) */
  max_rounds?: number;
  /** Consensus threshold 0-1 (consensus strategy) */
  threshold?: number;
  /** Number of candidates (best_of_n strategy) */
  n?: number;
}

export interface AgentsConfig {
  /** Named agent roles */
  agents: Record<string, AgentRoleConfig>;
  /** Named ensemble strategies */
  ensembles?: Record<string, EnsembleConfig>;
  /** Default agent for unspecified tasks */
  default_agent?: string;
  /** Global concurrency limit */
  max_concurrency?: number;
  /** Global timeout per task (ms) */
  task_timeout_ms?: number;
  /** Retry attempts on failure */
  retry_attempts?: number;
}

// ─── Config Paths ────────────────────────────────────────────────────────────

const USER_CONFIG_DIR = path.join(os.homedir(), ".sns-myagent");
const USER_CONFIG_PATH = path.join(USER_CONFIG_DIR, "agents.yaml");
const PROJECT_CONFIG_FILENAME = ".sns-myagent/agents.yaml";

function findProjectConfig(): string | null {
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    const candidate = path.join(dir, PROJECT_CONFIG_FILENAME);
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

// ─── YAML Parser (lightweight, no deps) ─────────────────────────────────────

/**
 * Minimal YAML parser for agents.yaml structure.
 * Handles: top-level keys, nested objects, arrays, strings, numbers, booleans.
 * NOT a full YAML parser — sufficient for our flat config schema.
 */
function parseYamlSimple(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split("\n");
  let currentKey = "";
  let currentSubObj: Record<string, unknown> | null = null;
  let currentArray: string[] | null = null;
  let inMultiline = false;
  let multilineKey = "";
  let multilineIndent = 0;
  let multilineLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    // Skip empty lines and comments
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Handle multiline strings (|)
    if (inMultiline) {
      if (indent > multilineIndent) {
        multilineLines.push(line.slice(multilineIndent + 2));
        continue;
      } else {
        // End multiline
        if (currentSubObj) {
          currentSubObj[multilineKey] = multilineLines.join("\n");
        } else {
          result[multilineKey] = multilineLines.join("\n");
        }
        inMultiline = false;
        multilineLines = [];
      }
    }

    // Top-level key
    if (indent === 0 && trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      currentKey = trimmed.slice(0, colonIdx).trim();
      const rest = trimmed.slice(colonIdx + 1).trim();
      if (rest === "|" || rest === ">") {
        inMultiline = true;
        multilineKey = currentKey;
        multilineIndent = 0;
        multilineLines = [];
      } else if (rest === "" || rest === "{}") {
        result[currentKey] = {};
      } else {
        result[currentKey] = parseValue(rest);
      }
      currentSubObj = null;
      currentArray = null;
      continue;
    }

    // Nested key (indent > 0)
    if (indent > 0 && trimmed.includes(":") && !trimmed.startsWith("-")) {
      const colonIdx = trimmed.indexOf(":");
      const subKey = trimmed.slice(0, colonIdx).trim();
      const rest = trimmed.slice(colonIdx + 1).trim();

      // Ensure parent exists as object
      if (!result[currentKey] || typeof result[currentKey] !== "object") {
        result[currentKey] = {};
      }
      const parent = result[currentKey] as Record<string, unknown>;

      if (rest === "|" || rest === ">") {
        inMultiline = true;
        multilineKey = subKey;
        multilineIndent = indent;
        multilineLines = [];
      } else if (rest === "") {
        // Could be a sub-sub-object; create placeholder
        if (!parent[subKey]) parent[subKey] = {};
      } else {
        parent[subKey] = parseValue(rest);
      }
      currentSubObj = parent;
      currentArray = null;
      continue;
    }

    // Array item
    if (trimmed.startsWith("- ")) {
      const value = trimmed.slice(2).trim();
      if (!result[currentKey]) {
        result[currentKey] = [];
      }
      const arr = result[currentKey] as string[];
      arr.push(parseValue(value) as string);
      currentArray = arr;
      continue;
    }

    // Sub-level array item (indented)
    if (indent > 0 && trimmed.startsWith("- ")) {
      const value = trimmed.slice(2).trim();
      if (currentSubObj) {
        // Find the last key in currentSubObj that's an array
        const keys = Object.keys(currentSubObj);
        const lastKey = keys[keys.length - 1];
        if (lastKey && Array.isArray(currentSubObj[lastKey])) {
          (currentSubObj[lastKey] as string[]).push(parseValue(value) as string);
        }
      }
      continue;
    }
  }

  // Close any open multiline
  if (inMultiline && multilineLines.length > 0) {
    if (currentSubObj) {
      currentSubObj[multilineKey] = multilineLines.join("\n");
    } else {
      result[multilineKey] = multilineLines.join("\n");
    }
  }

  return result;
}

function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  if (/^\d+\.\d+$/.test(raw)) return Number.parseFloat(raw);
  // Strip quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

// ─── Config Loader ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentsConfig = {
  agents: {},
  ensembles: {},
  default_agent: "task",
  max_concurrency: 4,
  task_timeout_ms: 120_000,
  retry_attempts: 3,
};

function parseConfig(raw: Record<string, unknown>): AgentsConfig {
  const config: AgentsConfig = { ...DEFAULT_CONFIG };

  if (raw.agents && typeof raw.agents === "object") {
    config.agents = raw.agents as Record<string, AgentRoleConfig>;
  }
  if (raw.ensembles && typeof raw.ensembles === "object") {
    config.ensembles = raw.ensembles as Record<string, EnsembleConfig>;
  }
  if (typeof raw.default_agent === "string") {
    config.default_agent = raw.default_agent;
  }
  if (typeof raw.max_concurrency === "number") {
    config.max_concurrency = raw.max_concurrency;
  }
  if (typeof raw.task_timeout_ms === "number") {
    config.task_timeout_ms = raw.task_timeout_ms;
  }
  if (typeof raw.retry_attempts === "number") {
    config.retry_attempts = raw.retry_attempts;
  }

  return config;
}

// ─── Singleton + Hot Reload ─────────────────────────────────────────────────

class AgentsConfigManager extends EventEmitter {
  #config: AgentsConfig = DEFAULT_CONFIG;
  #watcher: fs.FSWatcher | null = null;
  #configPath: string | null = null;

  get config(): AgentsConfig {
    return this.#config;
  }

  get configPath(): string | null {
    return this.#configPath;
  }

  /**
   * Load config from project-level, then user-level, then defaults.
   * Project overrides user which overrides defaults.
   */
  load(): AgentsConfig {
    const projectPath = findProjectConfig();
    const userPath = fs.existsSync(USER_CONFIG_PATH) ? USER_CONFIG_PATH : null;
    const loadPath = projectPath ?? userPath;

    if (!loadPath) {
      this.#config = DEFAULT_CONFIG;
      this.#configPath = null;
      return this.#config;
    }

    try {
      const text = fs.readFileSync(loadPath, "utf-8");
      const raw = parseYamlSimple(text);
      this.#config = parseConfig(raw);
      this.#configPath = loadPath;
    } catch {
      this.#config = DEFAULT_CONFIG;
      this.#configPath = null;
    }

    return this.#config;
  }

  /**
   * Start watching the config file for changes.
   * Emits 'reload' event when config changes.
   */
  watch(): void {
    if (this.#watcher) return;
    if (!this.#configPath) return;

    this.#watcher = fs.watch(this.#configPath, { persistent: false }, () => {
      this.load();
      this.emit("reload", this.#config);
    });
  }

  stopWatching(): void {
    if (this.#watcher) {
      this.#watcher.close();
      this.#watcher = null;
    }
  }

  /**
   * Resolve a role to its config. Falls back to default_agent.
   */
  resolveRole(roleName: string): AgentRoleConfig | null {
    return this.#config.agents[roleName] ?? null;
  }

  /**
   * Get ensemble config by name.
   */
  getEnsemble(name: string): EnsembleConfig | null {
    return this.#config.ensembles?.[name] ?? null;
  }

  /**
   * List all configured agent role names.
   */
  listRoles(): string[] {
    return Object.keys(this.#config.agents);
  }

  /**
   * List all configured ensemble names.
   */
  listEnsembles(): string[] {
    return Object.keys(this.#config.ensembles ?? {});
  }
}

// Singleton
let _instance: AgentsConfigManager | null = null;

export function getAgentsConfig(): AgentsConfigManager {
  if (!_instance) {
    _instance = new AgentsConfigManager();
    _instance.load();
  }
  return _instance;
}

export { AgentsConfigManager, DEFAULT_CONFIG, parseYamlSimple };
