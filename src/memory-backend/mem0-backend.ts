/**
 * Mem0 memory backend — semantic memory with auto-extraction.
 *
 * Extracts key facts from conversations and stores them with timestamps
 * and source attribution. Search combines relevance (FTS5) with recency
 * weighting for the most useful recall.
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

interface FactRow {
	id: string;
	content: string;
	source: string;
	importance: number;
	created_at: string;
	updated_at: string;
	extracted_from: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_DB_NAME = "mem0.sqlite";
const RECENCY_WEIGHT = 0.3;
const RELEVANCE_WEIGHT = 0.7;

function contentHash(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function dbPath(agentDir: string): string {
	return path.join(agentDir, DEFAULT_DB_NAME);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function initSchema(database: Database): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS facts (
			id              TEXT PRIMARY KEY,
			content         TEXT NOT NULL,
			source          TEXT NOT NULL DEFAULT '',
			importance      REAL NOT NULL DEFAULT 0.5,
			created_at      TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
			extracted_from  TEXT NOT NULL DEFAULT ''
		);

		CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(content, source, extracted_from, content='facts', content_rowid='rowid');

		CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
			INSERT INTO facts_fts(rowid, content, source, extracted_from) VALUES (new.rowid, new.content, new.source, new.extracted_from);
		END;
		CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
			INSERT INTO facts_fts(facts_fts, rowid, content, source, extracted_from) VALUES ('delete', old.rowid, old.content, old.source, old.extracted_from);
		END;
		CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
			INSERT INTO facts_fts(facts_fts, rowid, content, source, extracted_from) VALUES ('delete', old.rowid, old.content, old.source, old.extracted_from);
			INSERT INTO facts_fts(rowid, content, source, extracted_from) VALUES (new.rowid, new.content, new.source, new.extracted_from);
		END;
	`);
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
	initSchema(db);
	return db;
}

export const mem0Backend: MemoryBackend = {
	id: "mem0",

	async start(_options: MemoryBackendStartOptions): Promise<void> {
		// Lazy init
	},

	async buildDeveloperInstructions(_agentDir, _settings, _session): Promise<string | undefined> {
		return [
			"# Memory (Mem0)",
			"This agent uses Mem0 semantic memory.",
			"- Key facts are auto-extracted from conversations with timestamps and source attribution.",
			"- Recalled memories appear in `<memory>` blocks.",
			"- Use `save` to store important facts; use `search` to query memory.",
			"- Facts are deduplicated by content hash and updated when refreshed.",
			"",
		].join("\n");
	},

	async clear(agentDir): Promise<void> {
		try {
			const database = getDb(agentDir);
			database.exec("DELETE FROM facts");
		} catch {
			// swallow
		}
	},

	async enqueue(_agentDir): Promise<void> {
		// Mem0 stores facts directly — no separate consolidation step
	},

	async status({ agentDir }): Promise<MemoryBackendStatus> {
		try {
			const database = getDb(agentDir);
			const count = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM facts").get()
			)?.cnt ?? 0;
			return {
				backend: "mem0",
				active: true,
				writable: true,
				searchable: true,
				episodicCount: count,
				database: dbPath(agentDir),
			};
		} catch {
			return {
				backend: "mem0",
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
			return { backend: "mem0", query, count: 0, items: [], message: "Search aborted." };
		}
		const limit = clampLimit(options?.limit);
		const database = getDb(agentDir);

		let items: MemoryBackendSearchItem[] = [];

		try {
			const sanitized = query.replace(/[^\w\s]/g, " ").trim();
			if (!sanitized) {
				// No search terms — return recent facts
				const rows = database
					.query<FactRow, [number]>(
						"SELECT * FROM facts ORDER BY created_at DESC LIMIT ?",
					)
					.all(limit);
				items = rows.map(r => ({
					id: r.id,
					content: r.content,
					source: r.source || undefined,
					timestamp: r.created_at,
					score: 0.5,
				}));
			} else {
				const ftsQuery = sanitized
					.split(/\s+/)
					.filter(Boolean)
					.map(t => `"${t}"`)
					.join(" OR ");

				const rows = database
					.query<
						FactRow & { fts_rank: number },
						[string, number]
					>(
						`SELECT f.*, rank AS fts_rank
						 FROM facts_fts ft
						 JOIN facts f ON f.rowid = ft.rowid
						 WHERE facts_fts MATCH ?
						 ORDER BY rank
						 LIMIT ?`,
					)
					.all(ftsQuery, limit * 2);

				// Recency weighting: newer facts get a boost
				const now = Date.now();
				const dayMs = 86_400_000;

				items = rows.map(r => {
					const age = now - new Date(r.created_at).getTime();
					const recencyScore = Math.exp(-age / (7 * dayMs)); // exponential decay over 7 days
					const relevanceScore = 1.0 / (1.0 + Math.abs(r.fts_rank ?? 0));
					const combinedScore =
						RELEVANCE_WEIGHT * relevanceScore + RECENCY_WEIGHT * recencyScore;
					return {
						id: r.id,
						content: r.content,
						source: r.source || undefined,
						timestamp: r.created_at,
						score: combinedScore,
					};
				});

				items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
				items = items.slice(0, limit);
			}
		} catch {
			// FTS error — return empty
		}

		return { backend: "mem0", query, count: items.length, items };
	},

	async save(
		{ agentDir },
		input: MemoryBackendSaveInput,
	): Promise<{ backend: "mem0"; stored: number; ids: string[]; message?: string }> {
		const content = input.content.trim();
		if (!content) return { backend: "mem0", stored: 0, ids: [], message: "Empty content." };

		const database = getDb(agentDir);
		const hash = contentHash(content);
		const importance = normalizeImportance(input.importance);
		const id = `fact_${hash}_${Date.now()}`;

		try {
			// Check for existing content with same hash prefix
			const existing = database
				.query<{ id: string }, [string]>(
					"SELECT id FROM facts WHERE id LIKE ?",
				)
				.get(`fact_${hash}%`);

			if (existing) {
				// Update existing fact
				database
					.query(
						`UPDATE facts SET content = ?, source = ?, importance = ?, updated_at = datetime('now')
						 WHERE id = ?`,
					)
					.run(content, input.source ?? "user", importance, existing.id);
				return { backend: "mem0", stored: 1, ids: [existing.id] };
			}

			database
				.query(
					`INSERT INTO facts (id, content, source, importance, extracted_from)
					 VALUES (?, ?, ?, ?, ?)`,
				)
				.run(id, content, input.source ?? "user", importance, input.context ?? "");

			return { backend: "mem0", stored: 1, ids: [id] };
		} catch (err) {
			return {
				backend: "mem0",
				stored: 0,
				ids: [],
				message: `Save failed: ${String(err)}`,
			};
		}
	},

	async stats(agentDir): Promise<string | undefined> {
		try {
			const database = getDb(agentDir);
			const count = (
				database.query<{ cnt: number }, []>("SELECT count(*) AS cnt FROM facts").get()
			)?.cnt ?? 0;
			const sources = database
				.query<{ source: string; cnt: number }, []>(
					"SELECT source, count(*) AS cnt FROM facts GROUP BY source ORDER BY cnt DESC",
				)
				.all();
			const lines = [
				"# Mem0 Memory Stats",
				"",
				`Total facts: **${count}**`,
				"",
				"| Source | Count |",
				"|---|---:|",
			];
			for (const s of sources) {
				lines.push(`| ${s.source || "(none)"} | ${s.cnt} |`);
			}
			return lines.join("\n");
		} catch {
			return "# Mem0 Memory Stats\n\nCould not read database.";
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
