/**
 * Config loader for SNS-MyAgent (.sns-myagent/config.json)
 *
 * Uses only Node built-ins (fs, path, os) — no external deps.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Config } from "./schema.js";
import { validateConfig } from "./schema.js";
import { defaultConfig } from "./defaults.js";

/** Canonical config directory name (dotfolder in cwd). */
export const CONFIG_DIR_NAME = ".sns-myagent";
/** Canonical config file name. */
export const CONFIG_FILE_NAME = "config.json";

/** Resolve the .sns-myagent directory path. */
export function configDir(cwd: string = process.cwd()): string {
	return resolve(cwd, CONFIG_DIR_NAME);
}

/** Resolve the config.json path inside the config dir. */
export function configPath(cwd: string = process.cwd()): string {
	return join(configDir(cwd), CONFIG_FILE_NAME);
}

/** Build a fresh default Config object. */
export function defaultConfigFn(): Config {
	// Defensive copy so callers cannot mutate the exported reference.
	return JSON.parse(JSON.stringify(defaultConfig));
}

/**
 * Load + validate config.json from the given cwd (default: process.cwd()).
 * Returns null if the file does not exist (callers can decide to init).
 * Throws Error if the file exists but is invalid.
 */
export function loadConfig(cwd: string = process.cwd()): Config | null {
	const path = configPath(cwd);
	if (!existsSync(path)) return null;
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (err) {
		throw new Error(`failed to read ${path}: ${(err as Error).message}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(`config.json is not valid JSON: ${(err as Error).message}`);
	}
	return validateConfig(parsed);
}

/**
 * Write config to disk, creating parent directory if needed.
 * Writes with 2-space indent for readability and trailing newline.
 */
export function saveConfig(cfg: Config, cwd: string = process.cwd()): string {
	const dir = configDir(cwd);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const path = configPath(cwd);
	const json = JSON.stringify(cfg, null, 2) + "\n";
	writeFileSync(path, json, "utf8");
	return path;
}

/**
 * Ensure config.json exists. If missing, write defaults.
 * Returns the (existing or freshly created) Config and the path.
 */
export function ensureConfig(cwd: string = process.cwd()): { config: Config; path: string } {
	const existing = loadConfig(cwd);
	if (existing) return { config: existing, path: configPath(cwd) };
	const cfg = defaultConfigFn();
	const path = saveConfig(cfg, cwd);
	return { config: cfg, path };
}

/** Convenience: absolute path to user's home (for messages). */
export function homeDir(): string {
	return homedir();
}

// Re-export so consumers can import everything from "./loader".
export { defaultConfig } from "./defaults.js";
export type { Config } from "./schema.js";

// Reference dirname to avoid unused-import warnings under strict.
void dirname;