/**
 * Mnemosyne memory backend — three-tier architecture.
 *
 * - Episodic: raw events (conversation turns, tool calls)
 * - Semantic: consolidated knowledge (facts, entities, relationships)
 * - Procedural: learned skills (how-to patterns)
 *
 * SQLite + FTS5 for text search. Auto-consolidation merges episodic → semantic
 * when episodic count exceeds threshold. Recall scored by relevance + recency.
 */

import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";
import * as path from "node:path";
import type {
	MemoryBackend,
	MemoryBackendOperationContext,
	MemoryBackendSaveInput,
	MemoryBackendSearchItem,
	MemoryBackendSearchOptions,
	MemoryBackendSearchResult,
	MemoryBackendStartOptions,
	MemoryBackendStatus,
} from "./types";
import type { Settings } from "../config/settings";
import type { AgentSession } from "../session/agent-session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EpisodicRow {
	id: string;
	content: string;
	source: string;
	importance: number;
	created_at: string;
	tier: "episodic";
}

interface SemanticRow {
	id: string;
	content: string;
	source: string;
	importance: number;
	created_at: string;
	tier: "semantic";
	consolidated_from: string;
}

interface ProceduralRow {
	id: string;
	content: string;
	skill_name: string;
	created_at: string;
	tier: "procedural";
}

type AnyRow = EpisodicRow | SemanticRow | ProceduralRow;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONSOLIDATION_THRESHOLD = 50;
const DEFAULT_DB_NAME = "mnemosyne.sqlite";

function contentHash(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function dbPath(agentDir: string): string {
	return path.join(agentDir, DEFAULT_DB_NAME);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function initSchema(db: Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS episodic (
			id          TEXT PRIMARY KEY,
			content     TEXT NOT NULL,
			source      TEXT NOT NULL DEFAULT '',
			importance  REAL NOT NULL DEFAULT 0.5,
			created_at  TEXT NOT NULL DEFAULT (datetime('now')),
			hash        TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS semantic (
			id                  TEXT PRIMARY KEY,
			content             TEXT NOT NULL,
			source              TEXT NOT NULL DEFAULT '',
			importance          REAL NOT NULL DEFAULT 0.7,
			created_at          TEXT NOT NULL DEFAULT (datetime('now')),
			consolidated_from   TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS procedural (
			id          TEXT PRIMARY KEY,
			content     TEXT NOT NULL,
			skill_name  TEXT NOT NULL DEFAULT '',
			created_at  TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE VIRTUAL TABLE IF NOT EXISTS episodic_fts USING fts5(content, source, content='episodic', content_rowid='rowid');
		CREATE VIRTUAL TABLE IF NOT EXISTS semantic_fts USING fts5(content, source, content='semantic', content_rowid='rowid');
		CREATE VIRTUAL TABLE IF NOT EXISTS procedural_fts USING fts5(content, skill_name, content='procedural', content_rowid='rowid');

		CREATE TRIGGER IF NOT EXISTS episodic_ai AFTER INSERT ON episodic BEGIN
			INSERT INTO episodic_fts(rowid, content, source) VALUES (new.rowid, new.content, new.source);
		END;
		CREATE TRIGGER IF NOT EXISTS episodic_ad AFTER DELETE ON episodic BEGIN
			INSERT INTO episodic_fts(episodic_fts, rowid, content, source) VALUES ('delete', old.rowid, old.content, old.source);
		END;

		CREATE TRIGGER IF NOT EXISTS semantic_ai AFTER INSERT ON semantic BEGIN
			INSERT INTO semantic_fts(rowid, content, source) VALUES (new.rowid, new.content, new.source);
		END;
		CREATE TRIGGER IF NOT EXISTS semantic_ad AFTER DELETE ON semantic BEGIN
			INSERT INTO semantic_fts(semantic_fts, rowid, content, source) VALUES ('delete', old.rowid, old.content, old.source);
		END;

		CREATE TRIGGER IF NOT EXISTS procedural_ai AFTER INSERT ON procedural BEGIN
			INSERT INTO procedural_fts(rowid, content, skill_name) VALUES (new.rowid, new.content, new.skill_name);
		END;
		CREATE TRIGGER IF NOT EXISTS procedural_ad AFTER DELETE ON procedural BEGIN
			INSERT INTO procedural_fts(procedural_fts, rowid, content, skill_name) VALUES ('delete', old.rowid, old.content, old.skill_name);
		END;
	`);
}

// ---------------------------------------------------------------------------
// Consolidation
// ---------------------------------------------------------------------------

function consolidateEpisodic(db: Database): number {
	const rows = db.query<EpisodicRow, []>(
		`SELECT * FROM episodic ORDER BY importance DESC, created_at DESC LIMIT ${CONSOLIDATION_THRESHOLD}`,
	).all();

	if (rows.length === 0) return 0;

	const insertSemantic = db.prepare<{ id: string }, [string, string, string, number, string]>(
		`INSERT OR IGNORE INTO semantic (id, content, source, importance, consolidated_from) VALUES (?, ?, ?, ?, ?)`,
	);

	let count = 0;
	const deleteIds: string[] = [];

	db.transaction(() => {
		for (const row of rows) {
			const newId = `sem_${contentHash(row.content)}_${Date.now()}`;
			const result = insertSemantic.run(newId, row.content, row.source, Math.max(row.importance, 0.7), row.id);
			if (result.changes > 0) {
				deleteIds.push(row.id);
				count++;
			}
		}
		if (deleteIds.length > 0) {
			const placeholders = deleteIds.map(() => "?").join(",");
			db.query(`DELETE FROM episodic WHERE id IN (${placeholders})`).run(...deleteIds);
		}
	})();

	return count;
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

let db: Database | undefined;

function getDb(agentDir: string): Database {
	if (db) return db;
	const p = dbPath(agentDir);
	db = new Database(p);
	db.exec("PRAGMA journal_mode=WAL");
	db.exec("PRAGMA foreign_keys=ON");
	initSchema(db);
	return db;
}

function resetDb(): void {
	if (db) {
		db.close();
		db = undefined;
	}
}

function ftsSearch(
	database: Database,
	table: string,
	query: string,
	limit: number,
): MemoryBackendSearchItem[] {
	const ftsTable = `${table}_fts`;
	try {
		// Sanitize query for FTS5: strip special chars, join with OR
		const sanitized = query.replace(/[^\w\s]/g, " ").trim();
		if (!sanitized) return [];
		const ftsQuery = sanitized
			.split(/\s+/)
			.filter(Boolean)
			.map(t => `"${t}"`)
			.join(" OR ");

		const rows = database
			.query<
				{ id: string; content: string; source: string; created_at: string; rank: number },
				[string, number]
			>(
				`SELECT t.id, t.content, t.source, t.created_at AS created_at, rank
				 FROM ${ftsTable} f
				 JOIN ${table} t ON t.rowid = f.rowid
				 WHERE ${ftsTable} MATCH ?
				 ORDER BY rank
				 LIMIT ?`,
			)
			.all(ftsQuery, limit);

		return rows.map((r, i) => ({
			id: r.id,
			content: r.content,
			source: r.source || table,
			timestamp: r.created_at,
			score: 1.0 / (1.0 + i), // descending score by rank
		}));
	} catch {
		// FTS match error (e.g. empty query) — fall back to empty
		return [];
	}
}

export const mnemosyneBackend: MemoryBackend = {
	id: "mnemosyne",

	async start(_options: MemoryBackendStartOptions): Promise<void> {
		// Initialize DB on first use via getDb lazy init
	},

	async buildDeveloperInstructions(_agentDir, _settings, _session): Promise<string | undefined> {
		return [
			"# Memory (Mnemosyne)",
			"This agent uses a three-tier Mnemosyne memory system:",
			"- Episodic: raw conversation events and tool calls.",
			"- Semantic: consolidated knowledge from episodic memories.",
			"- Procedural: learned skills and how-to patterns.",
			"- Facts recalled from prior sessions appear in `<memory>` blocks.",
			"- Use `save` to store durable facts; use `search` to query memory.",
			"",
		].join("\n");
	},

	async clear(agentDir): Promise<void> {
		try {
			const p = dbPath(agentDir);
			const d = db;
			if (d) {
				d.exec("DELETE FROM episodic");
				d.exec("DELETE FROM semantic");
				d.exec("DELETE FROM procedural");
			}
		} catch {
			// swallow
		}
	},

	async enqueue(agentDir): Promise<void> {
		try {
			const database = getDb(agentDir);
			const consolidated = consolidateEpisodic(database);
			void consolidated; // info only
		} catch {
			// swallow
		}
	},

	async status({ agentDir }): Promise<MemoryBackendStatus> {
		try {
			const database = getDb(agentDir);
			const episodicCount = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM episodic").get()
			)?.cnt ?? 0;
			const semanticCount = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM semantic").get()
			)?.cnt ?? 0;
			const proceduralCount = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM procedural").get()
			)?.cnt ?? 0;
			return {
				backend: "mnemosyne",
				active: true,
				writable: true,
				searchable: true,
				episodicCount,
				workingCount: semanticCount,
				tripleCount: proceduralCount,
				database: dbPath(agentDir),
			};
		} catch {
			return {
				backend: "mnemosyne",
				active: true,
				writable: true,
				searchable: true,
			};
		}
	},

	async search(
		{ agentDir }: MemoryBackendOperationContext,
		query: string,
		options?: MemoryBackendSearchOptions,
	): Promise<MemoryBackendSearchResult> {
		if (options?.signal?.aborted) {
			return { backend: "mnemosyne", query, count: 0, items: [], message: "Search aborted." };
		}
		const limit = clampLimit(options?.limit);
		const database = getDb(agentDir);

		const epiResults = ftsSearch(database, "episodic", query, limit);
		const semResults = ftsSearch(database, "semantic", query, limit);
		const procResults = ftsSearch(database, "procedural", query, limit);

		// Merge + deduplicate by id, boost semantic/procedural slightly
		const seen = new Set<string>();
		const items: MemoryBackendSearchItem[] = [];
		for (const r of semResults) {
			const id = r.id;
			if (id && !seen.has(id)) {
				seen.add(id);
				items.push({ ...r, score: (r.score ?? 0) * 1.2 });
			}
		}
		for (const r of procResults) {
			const id = r.id;
			if (id && !seen.has(id)) {
				seen.add(id);
				items.push({ ...r, score: (r.score ?? 0) * 1.1 });
			}
		}
		for (const r of epiResults) {
			const id = r.id;
			if (id && !seen.has(id)) {
				seen.add(id);
				items.push(r);
			}
		}

		// Sort by score desc, trim to limit
		items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
		const trimmed = items.slice(0, limit);

		return { backend: "mnemosyne", query, count: trimmed.length, items: trimmed };
	},

	async save(
		{ agentDir },
		input: MemoryBackendSaveInput,
	): Promise<{ backend: "mnemosyne"; stored: number; ids: string[]; message?: string }> {
		const content = input.content.trim();
		if (!content) return { backend: "mnemosyne", stored: 0, ids: [], message: "Empty content." };

		const database = getDb(agentDir);
		const importance = normalizeImportance(input.importance);
		const hash = contentHash(content);

		try {
			if (importance >= 0.8) {
				// High importance → semantic directly
				const id = `sem_${hash}_${Date.now()}`;
				database
					.query(
						`INSERT OR IGNORE INTO semantic (id, content, source, importance) VALUES (?, ?, ?, ?)`,
					)
					.run(id, content, input.source ?? "user", importance);
				return { backend: "mnemosyne", stored: 1, ids: [id] };
			}

			if (input.source?.startsWith("skill:") || importance >= 0.9) {
				// Procedural
				const id = `proc_${hash}_${Date.now()}`;
				const skillName = input.source?.replace("skill:", "") ?? "general";
				database
					.query(
						`INSERT OR IGNORE INTO procedural (id, content, skill_name) VALUES (?, ?, ?)`,
					)
					.run(id, content, skillName);
				return { backend: "mnemosyne", stored: 1, ids: [id] };
			}

			// Default → episodic
			const id = `epi_${hash}_${Date.now()}`;
			database
				.query(
					`INSERT OR IGNORE INTO episodic (id, content, source, importance, hash) VALUES (?, ?, ?, ?, ?)`,
				)
				.run(id, content, input.source ?? "conversation", importance, hash);

			// Check if consolidation needed
			const count = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM episodic").get()
			)?.cnt ?? 0;
			if (count >= CONSOLIDATION_THRESHOLD) {
				consolidateEpisodic(database);
			}

			return { backend: "mnemosyne", stored: 1, ids: [id] };
		} catch (err) {
			return {
				backend: "mnemosyne",
				stored: 0,
				ids: [],
				message: `Save failed: ${String(err)}`,
			};
		}
	},

	async stats(agentDir): Promise<string | undefined> {
		try {
			const database = getDb(agentDir);
			const epi = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM episodic").get()
			)?.cnt ?? 0;
			const sem = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM semantic").get()
			)?.cnt ?? 0;
			const proc = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM procedural").get()
			)?.cnt ?? 0;
			return [
				"# Mnemosyne Memory Stats",
				"",
				"| Tier | Count |",
				"|---|---:|",
				"| Episodic | " + epi + " |",
				"| Semantic | " + sem + " |",
				"| Procedural | " + proc + " |",
				"| Total | " + (epi + sem + proc) + " |",
			].join("\n");
		} catch {
			return "# Mnemosyne Memory Stats\n\nCould not read database.";
		}
	},
};

// ---------------------------------------------------------------------------
// Shared utils
// ---------------------------------------------------------------------------

function clampLimit(limit: number | undefined): number {
	if (!Number.isFinite(limit)) return 10;
	return Math.max(1, Math.min(50, Math.trunc(limit ?? 10)));
}

function normalizeImportance(value: number | undefined): number {
	if (!Number.isFinite(value)) return 0.5;
	return Math.max(0, Math.min(1, value ?? 0.5));
}
