/**
 * SNS-MyAgent configuration overlay.
 * Provides BYOK (Bring Your Own Key) support and SNS-specific env vars.
 *
 * Environment variables:
 *   SNSMYAGENT_API_KEY    — API key for LLM provider
 *   SNSMYAGENT_MODEL      — Default model (e.g. "claude-sonnet-4-20250514")
 *   SNSMYAGENT_PROVIDER   — Default provider (e.g. "anthropic", "openai")
 *   SNSMYAGENT_CONFIG_DIR — Override config directory (default: ~/.sns-myagent)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const SNS_CONFIG_DIR_NAME = ".sns-myagent";
export const SNS_CONFIG_FILE = "config.yaml";
export const SNS_APP_NAME = "snsagent";

export interface SnsConfig {
	apiKey?: string;
	model?: string;
	provider?: string;
	configDir: string;
}

/**
 * Resolve the SNS-MyAgent config directory.
 * Priority: SNSMYAGENT_CONFIG_DIR env > ~/.sns-myagent
 */
export function getConfigDir(): string {
	if (process.env.SNSMYAGENT_CONFIG_DIR) {
		return process.env.SNSMYAGENT_CONFIG_DIR;
	}
	return path.join(os.homedir(), SNS_CONFIG_DIR_NAME);
}

/**
 * Load SNS-MyAgent config from env vars and config file.
 * Env vars take precedence over config file values.
 * BYOK: no API key is forced — user provides their own.
 */
export function loadSnsConfig(): SnsConfig {
	const configDir = getConfigDir();
	const configPath = path.join(configDir, SNS_CONFIG_FILE);

	let fileConfig: Record<string, string> = {};

	// Read YAML config if it exists (simple key: value parser)
	if (fs.existsSync(configPath)) {
		try {
			const content = fs.readFileSync(configPath, "utf-8");
			fileConfig = parseSimpleYaml(content);
		} catch {
			// Config file malformed — proceed with env-only config
		}
	}

	return {
		apiKey: process.env.SNSMYAGENT_API_KEY ?? fileConfig.api_key ?? fileConfig.apiKey,
		model: process.env.SNSMYAGENT_MODEL ?? fileConfig.model,
		provider: process.env.SNSMYAGENT_PROVIDER ?? fileConfig.provider,
		configDir,
	};
}

/**
 * Check if API key is configured (BYOK — user must provide own key).
 */
export function hasApiKey(): boolean {
	const config = loadSnsConfig();
	return Boolean(config.apiKey);
}

/**
 * Simple YAML parser for flat key: value files.
 * Handles: key: value, key: "quoted value", comments, blank lines.
 */
function parseSimpleYaml(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const colonIdx = trimmed.indexOf(":");
		if (colonIdx < 0) continue;
		const key = trimmed.slice(0, colonIdx).trim();
		let value = trimmed.slice(colonIdx + 1).trim();
		// Strip surrounding quotes
		if ((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

/**
 * Get the resolved config directory, creating it if it doesn't exist.
 */
export function ensureConfigDir(): string {
	const dir = getConfigDir();
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	return dir;
}

/**
 * Get version from package.json.
 */
export function getVersion(): string {
	try {
		// Walk up from this file to find package.json
		let dir = path.dirname(new URL(import.meta.url).pathname);
		while (dir !== path.dirname(dir)) {
			const pkgPath = path.join(dir, "package.json");
			if (fs.existsSync(pkgPath)) {
				const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
				return pkg.version ?? "0.1.0";
			}
			dir = path.dirname(dir);
		}
	} catch {}
	return "0.1.0";
}
