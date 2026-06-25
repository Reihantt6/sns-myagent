// ═══════════════════════════════════════════════════════════════════════════
// Cron Scheduler
//
// Background scheduler that checks every minute for due cron jobs and
// executes them. Supports prompt (agent), shell command, and skill actions.
// ═══════════════════════════════════════════════════════════════════════════

import { logger } from "@oh-my-pi/pi-utils";
import { CronStore } from "./cron-store";
import { parseCronExpression, describeCron } from "./cron-parser";
import type { CronJob, CronJobExecution, JobAction } from "./types";

export type JobExecutor = (
 action: JobAction,
 job: CronJob,
) => Promise<{ success: boolean; output?: string; error?: string }>;

export interface CronSchedulerOptions {
 /** Base directory for agent data. Defaults to getAgentDir(). */
 agentDir?: string;
 /** How often to check for due jobs, in ms. Default: 60000 (1 min) */
 intervalMs?: number;
 /** External executor for running job actions. Required for actual execution. */
 executor?: JobExecutor;
 /** Whether to start automatically. Default: false */
 autoStart?: boolean;
}

export class CronScheduler {
 private store: CronStore;
 private intervalMs: number;
 private executor: JobExecutor | null;
 private timer: ReturnType<typeof setInterval> | null = null;
 private running = new Set<string>();

 constructor(options?: CronSchedulerOptions) {
  this.store = new CronStore(options?.agentDir);
  this.intervalMs = options?.intervalMs ?? 60_000;
  this.executor = options?.executor ?? null;

  if (options?.autoStart) {
   this.start();
  }
 }

 /** Start the background scheduler. */
 start(): void {
  if (this.timer) return;
  logger.info(
   `Cron scheduler started (interval: ${this.intervalMs / 1000}s)`,
  );
  this.timer = setInterval(() => this.tick(), this.intervalMs);
  // Run an immediate tick
  this.tick().catch((err) => logger.error("Cron tick error:", err));
 }

 /** Stop the background scheduler. */
 stop(): void {
  if (!this.timer) return;
  clearInterval(this.timer);
  this.timer = null;
  logger.info("Cron scheduler stopped");
 }

 /** Whether the scheduler is running. */
 isRunning(): boolean {
  return this.timer !== null;
 }

 /** Single tick: check for due jobs and execute them. */
 private async tick(): Promise<void> {
  const now = new Date();
  const dueJobs = this.store.listDue(now);

  for (const job of dueJobs) {
   if (this.running.has(job.id)) {
    // Already running, skip
    continue;
   }
   await this.executeJob(job).catch((err) => {
    logger.error(`Cron job "${job.name}" (${job.id}) execution error:`, err);
   });
  }
 }

 /** Execute a single cron job. */
 async executeJob(job: CronJob): Promise<CronJobExecution> {
  const startedAt = Date.now();
  this.running.add(job.id);

  try {
   let result: { success: boolean; output?: string; error?: string };

   if (this.executor) {
    result = await this.executor(job.action, job);
   } else {
    result = await this.executeLocally(job.action);
   }

   const completedAt = Date.now();
   const exec: CronJobExecution = {
    jobId: job.id,
    jobName: job.name,
    startedAt,
    completedAt,
    success: result.success,
    error: result.error,
    output: result.output,
   };

   this.store.recordExecution(exec);
   this.store.updateNextRun(job.id);

   logger.info(
    `Cron job "${job.name}" ${result.success ? "completed" : "failed"} in ${completedAt - startedAt}ms`,
   );

   return exec;
  } finally {
   this.running.delete(job.id);
  }
 }

 /** Execute a job locally when no external executor is set. */
 private async executeLocally(
  action: JobAction,
 ): Promise<{ success: boolean; output?: string; error?: string }> {
  switch (action.type) {
   case "shell":
    return this.executeShell(action.command);
   case "prompt":
    // Without an agent session, we log the prompt but can't execute it
    logger.info(`Cron prompt action (no session): "${action.prompt}"`);
    return {
     success: true,
     output: `Prompt logged: ${action.prompt}`,
    };
   case "skill":
    logger.info(`Cron skill action (no executor): "${action.skillName}"`);
    return {
     success: true,
     output: `Skill logged: ${action.skillName}${action.args ? ` ${action.args}` : ""}`,
    };
  }
 }

 /** Execute a shell command via subprocess. */
 private async executeShell(
  command: string,
 ): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
   const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
   });

   const stdout = await new Response(proc.stdout).text();
   const stderr = await new Response(proc.stderr).text();
   const exitCode = await proc.exited;

   if (exitCode === 0) {
    return { success: true, output: stdout || undefined };
   } else {
    return {
     success: false,
     output: stdout || undefined,
     error: stderr || `Exit code: ${exitCode}`,
    };
   }
  } catch (err) {
   return { success: false, error: String(err) };
  }
 }

 // ── Store delegation ───────────────────────────────────────────────

 /** Access the underlying store. */
 getStore(): CronStore {
  return this.store;
 }

 /** Add a new job. Returns the created job with computed nextRunAt. */
 addJob(
  name: string,
  cron: string,
  action: JobAction,
  enabled = true,
 ): CronJob {
  // Validate the cron expression
  parseCronExpression(cron);

  return this.store.create({ id: crypto.randomUUID(), name, cron, action, enabled, lastRunAt: null });
 }

 /** Update an existing job. */
 updateJob(
  id: string,
  updates: Partial<Pick<CronJob, "name" | "cron" | "action" | "enabled">>,
 ): CronJob | null {
  return this.store.update(id, updates);
 }

 /** Remove a job. */
 removeJob(id: string): boolean {
  return this.store.delete(id);
 }

 /** List all jobs. */
 listJobs(): CronJob[] {
  return this.store.list();
 }

 /** Get a job by ID. */
 getJob(id: string): CronJob | null {
  return this.store.getById(id);
 }

 /** Get recent executions for a job. */
 getJobExecutions(jobId: string): CronJobExecution[] {
  return this.store.getExecutions(jobId);
 }

 /** Manually trigger a job. */
 async triggerJob(id: string): Promise<CronJobExecution> {
  const job = this.store.getById(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  return this.executeJob(job);
 }

 /** Get a human-readable description of the schedule. */
 describeSchedule(cronExpr: string): string {
  try {
   const parsed = parseCronExpression(cronExpr);
   return describeCron(parsed);
  } catch {
   return cronExpr;
  }
 }

 /** Clean up resources. */
 destroy(): void {
  this.stop();
  this.store.close();
 }
}

// ── Singleton ───────────────────────────────────────────────────────

let _instance: CronScheduler | null = null;

/**
 * Get or create the singleton CronScheduler.
 * Pass options only on first call.
 */
export function getCronScheduler(options?: CronSchedulerOptions): CronScheduler {
 if (!_instance) {
  _instance = new CronScheduler(options);
 }
 return _instance;
}
