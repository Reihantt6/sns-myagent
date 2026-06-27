// ═══════════════════════════════════════════════════════════════════════════
// Async Task Store — SQLite persistence
// Pattern: mirrors src/cron/cron-store.ts
// ═══════════════════════════════════════════════════════════════════════════

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AsyncTask, AsyncTaskRow, TaskStatus, CreateTaskOptions } from "./types";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS async_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  task_type TEXT NOT NULL DEFAULT 'prompt',
  description TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_async_tasks_status ON async_tasks(status);
CREATE INDEX IF NOT EXISTS idx_async_tasks_created ON async_tasks(created_at);
`;

function rowToTask(row: AsyncTaskRow): AsyncTask {
  return {
    id: row.id,
    status: row.status as TaskStatus,
    taskType: row.task_type as AsyncTask["taskType"],
    description: row.description,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

export class TaskStore {
  #db: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.#db = new Database(dbPath);
    this.#db.exec("PRAGMA journal_mode = WAL");
    this.#db.exec("PRAGMA foreign_keys = ON");
    this.#db.exec(SCHEMA_SQL);
  }

  create(opts: CreateTaskOptions): AsyncTask {
    const id = crypto.randomUUID();
    const now = Date.now();
    const taskType = opts.taskType ?? "prompt";

    this.#db.run(
      `INSERT INTO async_tasks (id, status, task_type, description, created_at, metadata)
       VALUES (?, 'pending', ?, ?, ?, ?)`,
      [id, taskType, opts.description, now, opts.metadata ? JSON.stringify(opts.metadata) : null],
    );

    return this.getById(id)!;
  }

  getById(id: string): AsyncTask | null {
    const row = this.#db.query<AsyncTaskRow, [string]>(
      "SELECT * FROM async_tasks WHERE id = ?",
    ).get(id);
    return row ? rowToTask(row) : null;
  }

  list(status?: TaskStatus, limit = 50): AsyncTask[] {
    const rows = status
      ? this.#db.query<AsyncTaskRow, [string, number]>(
          "SELECT * FROM async_tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?",
        ).all(status, limit)
      : this.#db.query<AsyncTaskRow, [number]>(
          "SELECT * FROM async_tasks ORDER BY created_at DESC LIMIT ?",
        ).all(limit);
    return rows.map(rowToTask);
  }

  listPending(limit = 20): AsyncTask[] {
    return this.list("pending", limit);
  }

  listRunning(): AsyncTask[] {
    return this.list("running");
  }

  updateStatus(id: string, status: TaskStatus, extra?: { result?: string; error?: string }): boolean {
    const now = Date.now();
    let sql: string;
    let params: (string | number | null)[];

    switch (status) {
      case "running":
        sql = "UPDATE async_tasks SET status = ?, started_at = ? WHERE id = ?";
        params = [status, now, id];
        break;
      case "completed":
        sql = "UPDATE async_tasks SET status = ?, completed_at = ?, result = ? WHERE id = ?";
        params = [status, now, extra?.result ?? null, id];
        break;
      case "failed":
        sql = "UPDATE async_tasks SET status = ?, completed_at = ?, error = ? WHERE id = ?";
        params = [status, now, extra?.error ?? null, id];
        break;
      case "cancelled":
        sql = "UPDATE async_tasks SET status = ?, completed_at = ? WHERE id = ?";
        params = [status, now, id];
        break;
      default:
        sql = "UPDATE async_tasks SET status = ? WHERE id = ?";
        params = [status, id];
    }

    const stmt = this.#db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.#db.run("DELETE FROM async_tasks WHERE id = ?", [id]);
    return result.changes > 0;
  }

  /** Clean up completed/failed tasks older than maxAgeMs */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const result = this.#db.run(
      "DELETE FROM async_tasks WHERE status IN ('completed', 'failed', 'cancelled') AND completed_at < ?",
      [cutoff],
    );
    return result.changes;
  }

  count(): { total: number; pending: number; running: number; completed: number; failed: number } {
    const row = this.#db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM async_tasks`,
      )
      .get() as { total: number; pending: number; running: number; completed: number; failed: number } | null;
    return row ?? { total: 0, pending: 0, running: 0, completed: 0, failed: 0 };
  }

  close(): void {
    this.#db.close();
  }
}

/** Singleton accessor */
let _instance: TaskStore | null = null;

export function getTaskStore(agentDir?: string): TaskStore {
  if (!_instance) {
    const dir = agentDir ?? `${process.env.HOME ?? "/tmp"}/.sns-myagent`;
    _instance = new TaskStore(`${dir}/async/tasks.db`);
  }
  return _instance;
}
