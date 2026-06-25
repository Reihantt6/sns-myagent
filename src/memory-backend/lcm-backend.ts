/**
 * LCM — Latent Context Memory backend.
 *
 * Compact conversation context using delta encoding (store only changes
 * since last turn) and multi-resolution storage (summary + detail levels).
 * Designed for efficient context injection with minimal token overhead.
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

interface ContextRow {
	id: string;
	turn_index: number;
	delta: string;
	summary: string;
	created_at: string;
	hash: string;
	parent_id: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_DB_NAME = "lcm.sqlite";

function contentHash(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function dbPath(agentDir: string): string {
	return path.join(agentDir, DEFAULT_DB_NAME);
}

function normalizeImportance(value: number | undefined): number {
	if (!Number.isFinite(value)) return 0.5;
	return Math.max(0, Math.min(1, value ?? 0.5));
}

function clampLimit(limit: number | undefined): number {
	if (!Number.isFinite(limit)) return 10;
	return Math.max(1, Math.min(50, Math.trunc(limit ?? 10)));
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function initSchema(database: Database): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS context (
			id          TEXT PRIMARY KEY,
			turn_index  INTEGER NOT NULL,
			delta       TEXT NOT NULL,
			summary     TEXT NOT NULL DEFAULT '',
			created_at  TEXT NOT NULL DEFAULT (datetime('now')),
			hash        TEXT NOT NULL,
			parent_id   TEXT
		);

		CREATE VIRTUAL TABLE IF NOT EXISTS context_fts USING fts5(delta, summary, content='context', content_rowid='rowid');

		CREATE TRIGGER IF NOT EXISTS context_ai AFTER INSERT ON context BEGIN
			INSERT INTO context_fts(rowid, delta, summary) VALUES (new.rowid, new.delta, new.summary);
		END;
		CREATE TRIGGER IF NOT EXISTS context_ad AFTER DELETE ON context BEGIN
			INSERT INTO context_fts(context_fts, rowid, delta, summary) VALUES ('delete', old.rowid, old.delta, old.summary);
		END;

		CREATE TABLE IF NOT EXISTS metadata (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`);
}

// ---------------------------------------------------------------------------
// Delta encoding
// ---------------------------------------------------------------------------

function computeDelta(previous: string, current: string): string {
	if (!previous) return current;
	const prevWords = previous.split(/\s+/);
	const currWords = current.split(/\s+/);
	// Find the first divergence point
	let startIdx = 0;
	while (startIdx < prevWords.length && startIdx < currWords.length && prevWords[startIdx] === currWords[startIdx]) {
		startIdx++;
	}
	// Return only the changed suffix
	const deltaWords = currWords.slice(startIdx);
	return deltaWords.join(" ");
}

function getLatestContext(database: Database): ContextRow | null {
	return database
		.query<ContextRow, []>(
			"SELECT * FROM context ORDER BY turn_index DESC LIMIT 1",
		)
		.get();
}

function getNextTurnIndex(database: Database): number {
	const latest = getLatestContext(database);
	return (latest?.turn_index ?? -1) + 1;
}

// ---------------------------------------------------------------------------
// DB lifecycle
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

// ---------------------------------------------------------------------------
// Multi-resolution: build summary from recent deltas
// ---------------------------------------------------------------------------

function buildSummary(database: Database, limit: number = 20): string {
	const rows = database
		.query<ContextRow, [number]>(
			"SELECT delta FROM context ORDER BY turn_index DESC LIMIT ?",
		)
		.all(limit);
	if (rows.length === 0) return "";
	// Combine recent deltas into a compact summary
	const combined = rows.reverse().map(r => r.delta).join(" | ");
	// Truncate to ~500 chars for summary resolution
	if (combined.length <= 500) return combined;
	return combined.slice(0, 497) + "...";
}

// ---------------------------------------------------------------------------
// Backend export
// ---------------------------------------------------------------------------

export const lcmBackend: MemoryBackend = {
	id: "lcm",

	async start(_options: MemoryBackendStartOptions): Promise<void> {
		// Lazy init
	},

	async buildDeveloperInstructions(_agentDir, _settings, _session): Promise<string | undefined> {
		return [
			"# Memory (LCM — Latent Context Memory)",
			"This agent uses compact context memory with delta encoding.",
			"- Stores only changes since last turn for efficiency.",
			"- Multi-resolution: summary level (compact) + detail level (full deltas).",
			"- Recent context is injected into prompts for continuity.",
			"- Use `save` to store key context; use `search` to query memory.",
			"",
		].join("\n");
	},

	async clear(agentDir): Promise<void> {
		try {
			const database = getDb(agentDir);
			database.exec("DELETE FROM context");
			database.exec("DELETE FROM metadata");
		} catch {
			// swallow
		}
	},

	async enqueue(_agentDir): Promise<void> {
		// Multi-resolution summaries are built on-demand at query time
	},

	async status({ agentDir }): Promise<MemoryBackendStatus> {
		try {
			const database = getDb(agentDir);
			const count = (
				database.query<{ cnt: number }, []>(
					"SELECT count(*) AS cnt FROM context",
				).get()
			)?.cnt ?? 0;
			const latest = getLatestContext(database);
			return {
				backend: "lcm",
				active: true,
				writable: true,
				searchable: true,
				episodicCount: count,
				lastMemory: latest?.created_at,
				database: dbPath(agentDir),
			};
		} catch {
			return {
				backend: "lcm",
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
			return { backend: "lcm", query, count: 0, items: [], message: "Search aborted." };
		}
		const limit = clampLimit(options?.limit);
		const database = getDb(agentDir);

		let items: MemoryBackendSearchItem[] = [];
		try {
			const sanitized = query.replace(/[^\w\s]/g, " ").trim();
			if (!sanitized) {
				// Return recent context entries
				const rows = database
					.query<ContextRow, [number]>(
						"SELECT * FROM context ORDER BY turn_index DESC LIMIT ?",
					)
					.all(limit);
				items = rows.map(r => ({
					id: r.id,
					content: r.delta,
					timestamp: r.created_at,
					score: 0.5,
					source: "lcm-detail",
				}));
			} else {
				const ftsQuery = sanitized
					.split(/\s+/)
					.filter(Boolean)
					.map(t => `"${t}"`)
					.join(" OR ");

				// Search both detail (delta) and summary levels
				const detailRows = database
					.query<ContextRow & { fts_rank: number }, [string, number]>(
						`SELECT c.*, rank AS fts_rank
						 FROM context_fts cf
						 JOIN context c ON c.rowid = cf.rowid
						 WHERE context_fts MATCH ?
						 ORDER BY rank
						 LIMIT ?`,
					)
					.all(ftsQuery, limit);

				const now = Date.now();
				const dayMs = 86_400_000;

				items = detailRows.map((r, i) => {
					const age = now - new Date(r.created_at).getTime();
					const recencyScore = Math.exp(-age / (3 * dayMs));
					const relevanceScore = 1.0 / (1.0 + Math.abs(r.fts_rank ?? 0));
					return {
						id: r.id,
						content: r.delta,
						timestamp: r.created_at,
						score: 0.7 * relevanceScore + 0.3 * recencyScore,
						source: "lcm-detail",
					};
				});

				// Add summary resolution if we have few detail results
				if (items.length < limit) {
					const summary = buildSummary(database, 20);
					if (summary) {
						items.push({
							content: summary,
							score: 0.3,
							source: "lcm-summary",
						});
					}
				}

				items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
				items = items.slice(0, limit);
			}
		} catch {
			// FTS error — empty
		}

		return { backend: "lcm", query, count: items.length, items };
	},

	async save(
		{ agentDir },
		input: MemoryBackendSaveInput,
	): Promise<{ backend: "lcm"; stored: number; ids: string[]; message?: string }> {
		const content = input.content.trim();
		if (!content) {
			return { backend: "lcm", stored: 0, ids: [], message: "Empty content." };
		}

		const database = getDb(agentDir);
		const hash = contentHash(content);
		const turnIndex = getNextTurnIndex(database);

		try {
			// Delta encoding: compute diff from last turn
			const latest = getLatestContext(database);
			const previousContent = latest?.delta ?? "";
			const delta = computeDelta(previousContent, content);

			// Skip if delta is empty (no change)
			if (!delta.trim()) {
				return { backend: "lcm", stored: 0, ids: [], message: "No changes from previous turn." };
			}

			const id = `ctx_${hash}_${turnIndex}`;
			database
				.query(
					`INSERT INTO context (id, turn_index, delta, summary, hash, parent_id)
					 VALUES (?, ?, ?, ?, ?, ?)`,
				)
				.run(id, turnIndex, delta, "", hash, latest?.id ?? null);

			// Update summary for the new entry
			const summary = buildSummary(database, 10);
			database
				.query("UPDATE context SET summary = ? WHERE id = ?")
				.run(summary, id);

			return { backend: "lcm", stored: 1, ids: [id] };
		} catch (err) {
			return {
				backend: "lcm",
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
				database.query<{ cnt: number }, []>(
					"SELECT count(*) AS cnt FROM context",
				).get()
			)?.cnt ?? 0;
			const totalDeltaLen = (
				database.query<{ total: number }, []>(
					"SELECT coalesce(sum(length(delta)), 0) AS total FROM context",
				).get()
			)?.total ?? 0;
			const summaryLen = buildSummary(database, 50).length;
			return [
				"# LCM Memory Stats",
				"",
				"| Metric | Value |",
				"|---|---:|",
				`| Context entries | ${count} |`,
				`| Total delta bytes | ${totalDeltaLen} |`,
				`| Summary resolution | ${summaryLen} chars |`,
			].join("\n");
		} catch {
			return "# LCM Memory Stats\n\nCould not read database.";
		}
	},
};
