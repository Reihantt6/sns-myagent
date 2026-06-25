/**
 * Config system for SNS-MyAgent.
 *
 * Re-exports the core sns-config functions and adds:
 *  - `loadConfig()` / `getConfig()` / `saveConfig()` (cached singleton)
 *  - js-yaml based parsing (replaces the simple inline parser)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import {
	type SnsConfig,
	ensureConfigDir,
	getConfigDir,
	getVersion,
	hasApiKey,
	loadSnsConfig,
} from "./sns-config.js";
import { DEFAULT_CONFIG_FILE, DEFAULT_CONFIG_YAML, DEFAULT_MODEL, DEFAULT_PROVIDER } from "./defaults.js";

// Re-export everything from sns-config so callers can import from `#src/config`.
export {
	type SnsConfig,
	ensureConfigDir,
	getConfigDir,
	getVersion,
	hasApiKey,
	loadSnsConfig,
} from "./sns-config.js";
export * from "./defaults.js";

/** Full config shape returned by `loadConfig()`. */
export interface FullConfig extends SnsConfig {
	/** Resolved provider (falls back to DEFAULT_PROVIDER). */
	provider: string;
	/** Resolved model (falls back to DEFAULT_MODEL). */
	model: string;
	/** Package version string. */
	version: string;
}

/** Cached singleton — populated once per process. */
let cachedConfig: FullConfig | null = null;

/**
 * Load the full config, reading env vars + config file, applying defaults.
 * First call writes a default config file if none exists.
 */
export function loadConfig(): FullConfig {
	if (cachedConfig) return cachedConfig;

	const raw = loadSnsConfig();
	const configDir = ensureConfigDir();

	// Write default config on first run.
	const configPath = path.join(configDir, DEFAULT_CONFIG_FILE);
	if (!fs.existsSync(configPath)) {
		try {
			fs.writeFileSync(configPath, DEFAULT_CONFIG_YAML, "utf-8");
		} catch {
			// Non-fatal — proceed without file.
		}
	}

	cachedConfig = {
		...raw,
		provider: raw.provider ?? DEFAULT_PROVIDER,
		model: raw.model ?? DEFAULT_MODEL,
		version: getVersion(),
	};
	return cachedConfig;
}

/**
 * Get the cached config (must call `loadConfig()` first or it auto-loads).
 */
export function getConfig(): FullConfig {
	return cachedConfig ?? loadConfig();
}

/**
 * Save config values to the YAML config file.
 * Merges with existing file content.
 */
export function saveConfig(patch: Partial<SnsConfig>): void {
	const configDir = ensureConfigDir();
	const configPath = path.join(configDir, DEFAULT_CONFIG_FILE);

	let existing: Record<string, unknown> = {};
	if (fs.existsSync(configPath)) {
		try {
			const content = fs.readFileSync(configPath, "utf-8");
			existing = (yaml.load(content) as Record<string, unknown>) ?? {};
		} catch {
			// Corrupted file — overwrite.
		}
	}

	const merged = { ...existing, ...patch };
	fs.writeFileSync(configPath, yaml.dump(merged, { lineWidth: 100 }), "utf-8");

	// Invalidate cache so next getConfig() picks up new values.
	cachedConfig = null;
}
