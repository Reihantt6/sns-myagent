/**
 * Default Config values for SNS-MyAgent.
 * Mirrors the schema in ./schema.ts. Kept separate so tests can import without
 * pulling in the full loader module.
 */
import type { Config } from "./schema.js";

/** Default config file name (inside the config directory). */
export const DEFAULT_CONFIG_FILE = "config.yaml";

export const defaultConfig: Config = {
	version: 1,
	agentName: "sns-myagent",
	model: {
		provider: "openai",
		model: "gpt-4o-mini",
		temperature: 0.7,
		maxTokens: 4096,
	},
	telegram: {
		token: "",
		allowedChatIds: [],
		pollIntervalMs: 1000,
	},
	memory: {
		path: "memory.jsonl",
		maxEntries: 1000,
		autoSummarize: true,
		backend: "mnemopi",
	},
};

/** Default YAML body written to disk on first run. Derived from defaultConfig. */
export const DEFAULT_CONFIG_YAML =
	`# SNS-MyAgent config (auto-generated on first run)\n` +
	`version: 1\n` +
	`agentName: ${defaultConfig.agentName}\n` +
	`model:\n` +
	`  provider: ${defaultConfig.model.provider}\n` +
	`  model: ${defaultConfig.model.model}\n` +
	`  temperature: ${defaultConfig.model.temperature}\n` +
	`  maxTokens: ${defaultConfig.model.maxTokens}\n` +
	`telegram:\n` +
	`  token: ""\n` +
	`  allowedChatIds: []\n` +
	`  pollIntervalMs: ${defaultConfig.telegram.pollIntervalMs}\n` +
	`memory:\n` +
		`  path: ${defaultConfig.memory.path}\n` +
		`  maxEntries: ${defaultConfig.memory.maxEntries}\n` +
		`  autoSummarize: ${defaultConfig.memory.autoSummarize}\n` +
		`  backend: ${defaultConfig.memory.backend}\n`;

/** Default LLM provider id. */
export const DEFAULT_PROVIDER = defaultConfig.model.provider;

/** Default LLM model id. */
export const DEFAULT_MODEL = defaultConfig.model.model;
