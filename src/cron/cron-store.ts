// ═══════════════════════════════════════════════════════════════════════════
// Cron Job SQLite Store
//
// Persists cron jobs in SQLite using bun:sqlite (same pattern as mnemopi).
// DB lives in the agent config dir under cron/cron.db.
// ═══════════════════════════════════════════════════════════════════════════

import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, logger } from "@oh-my-pi/pi-utils";
import { parseCronExpression, getNextCronRun } from "./cron-parser";
import type { CronJob, CronJobRow, CronJobExecution } from "./types";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cron_jobs (
 id          TEXT PRIMARY KEY,
 name        TEXT NOT NULL,
 cron        TEXT NOT NULL,
 action_type TEXT NOT NULL CHECK (action_type IN ('prompt', 'shell', 'skill')),
 action_prompt   TEXT,
 action_command   TEXT,
 action_skill_name TEXT,
 action_skill_args TEXT,
 enabled     INTEGER NOT NULL DEFAULT 1,
 last_run_at INTEGER,
 next_run_at INTEGER,
 created_at  INTEGER NOT NULL,
 updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cron_executions (
 id         INTEGER PRIMARY KEY AUTOINCREMENT,
 job_id     TEXT NOT NULL,
 job_name   TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 completed_at INTEGER NOT NULL,
 success    INTEGER NOT NULL,
 error      TEXT,
 output     TEXT,
 FOREIGN KEY (job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled ON cron_jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_cron_exec_job_id ON cron_executions(job_id);
`;

function rowToJob(row: CronJobRow): CronJob {
 const action =
  row.action_type === "prompt"
   ? { type: "prompt" as const, prompt: row.action_prompt ?? "" }
   : row.action_type === "shell"
     ? { type: "shell" as const, command: row.action_command ?? "" }
     : {
       type: "skill" as const,
       skillName: row.action_skill_name ?? "",
       args: row.action_skill_args ?? undefined,
      };

 return {
  id: row.id,
  name: row.name,
  cron: row.cron,
  action,
  enabled: row.enabled === 1,
  lastRunAt: row.last_run_at,
  nextRunAt: row.next_run_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
 };
}

export class CronStore {
 private db: Database;

 constructor(agentDir?: string) {
  const base = agentDir ?? getAgentDir();
  const cronDir = path.join(base, "cron");
  fs.mkdirSync(cronDir, { recursive: true });
  const dbPath = path.join(cronDir, "cron.db");

  this.db = new Database(dbPath);
  this.db.exec("PRAGMA journal_mode = WAL");
  this.db.exec("PRAGMA foreign_keys = ON");
  this.db.exec(SCHEMA_SQL);

  logger.debug(`Cron store initialized at ${dbPath}`);
 }

 /** Create a new cron job. Returns the created job. */
 create(job: Omit<CronJob, "createdAt" | "updatedAt" | "nextRunAt">): CronJob {
  const now = Date.now();
  const parsed = parseCronExpression(job.cron);
  const nextRun = getNextCronRun(parsed, new Date());

  const id = job.id || crypto.randomUUID();
  const stmt = this.db.prepare(`
   INSERT INTO cron_jobs (id, name, cron, action_type, action_prompt, action_command,
    action_skill_name, action_skill_args, enabled, next_run_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const action = job.action;
  stmt.run(
   id,
   job.name,
   job.cron,
   action.type,
   action.type === "prompt" ? action.prompt : null,
   action.type === "shell" ? action.command : null,
   action.type === "skill" ? action.skillName : null,
   action.type === "skill" ? (action.args ?? null) : null,
   job.enabled ? 1 : 0,
   nextRun?.getTime() ?? null,
   now,
   now,
  );

  return this.getById(id)!;
 }

 /** Get a single job by ID. */
 getById(id: string): CronJob | null {
  const row = this.db
   .prepare("SELECT * FROM cron_jobs WHERE id = ?")
   .get(id) as CronJobRow | undefined;
  return row ? rowToJob(row) : null;
 }

 /** List all jobs. */
 list(): CronJob[] {
  const rows = this.db
   .prepare("SELECT * FROM cron_jobs ORDER BY created_at ASC")
   .all() as CronJobRow[];
  return rows.map(rowToJob);
 }

 /** List enabled jobs. */
 listEnabled(): CronJob[] {
  const rows = this.db
   .prepare("SELECT * FROM cron_jobs WHERE enabled = 1 ORDER BY next_run_at ASC")
   .all() as CronJobRow[];
  return rows.map(rowToJob);
 }

 /** List jobs due to run at or before the given timestamp. */
 listDue(before: Date): CronJob[] {
  const ts = before.getTime();
  const rows = this.db
   .prepare(
    "SELECT * FROM cron_jobs WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?",
   )
   .all(ts) as CronJobRow[];
  return rows.map(rowToJob);
 }

 /** Update a job. */
 update(
  id: string,
  updates: Partial<Pick<CronJob, "name" | "cron" | "action" | "enabled">>,
 ): CronJob | null {
  const existing = this.getById(id);
  if (!existing) return null;

  const now = Date.now();
  const cron = updates.cron ?? existing.cron;
  const enabled = updates.enabled ?? existing.enabled;
  const action = updates.action ?? existing.action;
  const name = updates.name ?? existing.name;

  let nextRunAt: number | null = null;
  if (enabled) {
   const parsed = parseCronExpression(cron);
   const next = getNextCronRun(parsed, new Date());
   nextRunAt = next?.getTime() ?? null;
  }

  this.db
   .prepare(
    `UPDATE cron_jobs
    SET name = ?, cron = ?, action_type = ?, action_prompt = ?, action_command = ?,
     action_skill_name = ?, action_skill_args = ?, enabled = ?, next_run_at = ?, updated_at = ?
    WHERE id = ?`,
   )
   .run(
    name,
    cron,
    action.type,
    action.type === "prompt" ? action.prompt : null,
    action.type === "shell" ? action.command : null,
    action.type === "skill" ? action.skillName : null,
    action.type === "skill" ? (action.args ?? null) : null,
    enabled ? 1 : 0,
    nextRunAt,
    now,
    id,
   );

  return this.getById(id);
 }

 /** Update next_run_at for a job after execution. */
 updateNextRun(id: string): CronJob | null {
  const existing = this.getById(id);
  if (!existing) return null;

  const now = Date.now();
  const parsed = parseCronExpression(existing.cron);
  const next = getNextCronRun(parsed, new Date());
  const nextRunAt = next?.getTime() ?? null;

  this.db
   .prepare("UPDATE cron_jobs SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?")
   .run(now, nextRunAt, now, id);

  return this.getById(id);
 }

 /** Delete a job. */
 delete(id: string): boolean {
  const result = this.db.prepare("DELETE FROM cron_jobs WHERE id = ?").run(id);
  return result.changes > 0;
 }

 /** Record a job execution. */
 recordExecution(exec: CronJobExecution): void {
  this.db
   .prepare(
    `INSERT INTO cron_executions (job_id, job_name, started_at, completed_at, success, error, output)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
   )
   .run(
    exec.jobId,
    exec.jobName,
    exec.startedAt,
    exec.completedAt,
    exec.success ? 1 : 0,
    exec.error ?? null,
    exec.output ?? null,
   );
 }

 /** Get recent executions for a job. */
 getExecutions(jobId: string, limit = 10): CronJobExecution[] {
  const rows = this.db
   .prepare(
    "SELECT * FROM cron_executions WHERE job_id = ? ORDER BY started_at DESC LIMIT ?",
   )
   .all(jobId, limit) as Array<{
   job_id: string;
   job_name: string;
   started_at: number;
   completed_at: number;
   success: number;
   error: string | null;
   output: string | null;
  }>;

  return rows.map((r) => ({
   jobId: r.job_id,
   jobName: r.job_name,
   startedAt: r.started_at,
   completedAt: r.completed_at,
   success: r.success === 1,
   error: r.error ?? undefined,
   output: r.output ?? undefined,
  }));
 }

 /** Close the database connection. */
 close(): void {
  this.db.close();
 }
}
