/**
 * TBM settings bridge — connects the persisted settings schema (`tbm.*` keys in
 * `src/config/settings-schema.ts`) to the `TbmConfig` consumed by `TbmManager`.
 *
 * The session reads config through `Settings.get(...)`; this module maps those
 * flat, schema-typed values onto the nested `TbmConfig` shape and resolves them
 * against `DEFAULT_TBM_CONFIG`. This is the single place where TBM config is
 * parsed from settings, so a `tbm:` block in config.yml now has a real runtime
 * effect (previously `resolveTbmConfig` had no consumer).
 */

import type { Settings } from "../config/settings";
import { resolveTbmConfig, type TbmConfig } from "./config";

export function resolveTbmConfigFromSettings(settings: Settings): TbmConfig {
	return resolveTbmConfig({
		enabled: settings.get("tbm.enabled"),
		context_delta: {
			enabled: settings.get("tbm.contextDelta"),
		},
		pyramid: {
			enabled: settings.get("tbm.pyramid"),
			start_level: settings.get("tbm.pyramidStartLevel"),
			max_level: settings.get("tbm.pyramidMaxLevel"),
		},
		lazy_skills: {
			enabled: settings.get("tbm.lazySkills"),
			name_budget: settings.get("tbm.lazySkillsNameBudget"),
			max_per_turn: settings.get("tbm.lazySkillsMaxPerTurn"),
		},
		compress: {
			enabled: settings.get("tbm.compress"),
			budgets: {
				terminal: settings.get("tbm.compressTerminal"),
				read_file: settings.get("tbm.compressReadFile"),
				web_extract: settings.get("tbm.compressWebExtract"),
				search_files: settings.get("tbm.compressSearchFiles"),
				default: settings.get("tbm.compressDefault"),
			},
		},
		comm_mode: settings.get("tbm.commMode") as TbmConfig["comm_mode"],
		tombstone: {
			enabled: settings.get("tbm.tombstone"),
			after_turns: settings.get("tbm.tombstoneAfterTurns"),
			keep_recent: settings.get("tbm.tombstoneKeepRecent"),
		},
		response_cache: {
			enabled: settings.get("tbm.responseCache"),
			ttl_seconds: settings.get("tbm.responseCacheTtl"),
			max_entries: settings.get("tbm.responseCacheMaxEntries"),
			similarity_threshold: settings.get("tbm.responseCacheSimilarity"),
		},
	});
}
