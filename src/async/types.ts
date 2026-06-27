// ═══════════════════════════════════════════════════════════════════════════
// Async Workflow Types
// ═══════════════════════════════════════════════════════════════════════════

/** Task execution status */
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** Task action type */
export type TaskActionType = "prompt" | "shell" | "skill";

/** Task action — what to execute */
export type TaskAction =
  | { type: "prompt"; prompt: string }
  | { type: "shell"; command: string }
  | { type: "skill"; skillName: string; args?: string };

/** Stored async task — domain model (camelCase) */
export interface AsyncTask {
  id: string;
  status: TaskStatus;
  taskType: TaskActionType;
  description: string;
  result: string | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  metadata: Record<string, unknown> | null;
}

/** Row shape coming out of SQLite (snake_case) */
export interface AsyncTaskRow {
  id: string;
  status: string;
  task_type: string;
  description: string;
  result: string | null;
  error: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  metadata: string | null;
}

/** Options for creating a new task */
export interface CreateTaskOptions {
  description: string;
  taskType?: TaskActionType;
  metadata?: Record<string, unknown>;
}

/** Task execution result */
export interface TaskExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
}

/** Notification channel */
export type NotifyChannel = "cli" | "telegram";

/** Notification callback */
export type NotifyCallback = (task: AsyncTask, channel: NotifyChannel) => void | Promise<void>;

/** Task runner options */
export interface TaskRunnerOptions {
  maxConcurrent?: number;
  defaultTimeoutMs?: number;
  pollIntervalMs?: number;
}
