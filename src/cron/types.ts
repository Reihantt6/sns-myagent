// ═══════════════════════════════════════════════════════════════════════════
// Cron Scheduler Types
// ═══════════════════════════════════════════════════════════════════════════

/** Standard 5-field cron expression: minute hour day-of-month month day-of-week */
export interface CronExpression {
 minute: string;
 hour: string;
 dayOfMonth: string;
 month: string;
 dayOfWeek: string;
}

/** The raw cron string */
export type CronString = string;

/** Job action type determines what the cron job executes */
export type JobAction =
 | { type: "prompt"; prompt: string }
 | { type: "shell"; command: string }
 | { type: "skill"; skillName: string; args?: string };

/** Job status */
export type JobStatus = "active" | "paused" | "completed";

/** Stored cron job */
export interface CronJob {
 id: string;
 name: string;
 cron: string;
 action: JobAction;
 enabled: boolean;
 lastRunAt: number | null;
 nextRunAt: number | null;
 createdAt: number;
 updatedAt: number;
}

/** Row shape coming out of SQLite */
export interface CronJobRow {
 id: string;
 name: string;
 cron: string;
 action_type: string;
 action_prompt: string | null;
 action_command: string | null;
 action_skill_name: string | null;
 action_skill_args: string | null;
 enabled: number;
 last_run_at: number | null;
 next_run_at: number | null;
 created_at: number;
 updated_at: number;
}

/** Result of a cron job execution */
export interface CronJobExecution {
 jobId: string;
 jobName: string;
 startedAt: number;
 completedAt: number;
 success: boolean;
 error?: string;
 output?: string;
}
