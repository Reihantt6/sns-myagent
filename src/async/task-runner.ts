// ═══════════════════════════════════════════════════════════════════════════
// Async Task Runner — background execution engine
// ═══════════════════════════════════════════════════════════════════════════

import type { AsyncTask, TaskExecutionResult, TaskRunnerOptions, NotifyCallback } from "./types";
import { TaskStore, getTaskStore } from "./task-store";

export type TaskExecutor = (task: AsyncTask) => Promise<TaskExecutionResult>;

export class TaskRunner {
  #store: TaskStore;
  #running: Map<string, AbortController> = new Map();
  #executors: Map<string, TaskExecutor> = new Map();
  #notifyCallbacks: NotifyCallback[] = [];
  #maxConcurrent: number;
  #defaultTimeoutMs: number;
  #pollTimer: ReturnType<typeof setInterval> | null = null;
  #destroyed = false;

  constructor(store: TaskStore, options: TaskRunnerOptions = {}) {
    this.#store = store;
    this.#maxConcurrent = options.maxConcurrent ?? 3;
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? 5 * 60 * 1000; // 5 min default
  }

  /** Register an executor for a task type */
  registerExecutor(taskType: string, executor: TaskExecutor): void {
    this.#executors.set(taskType, executor);
  }

  /** Register notification callback */
  onNotify(callback: NotifyCallback): void {
    this.#notifyCallbacks.push(callback);
  }

  /** Start the polling loop */
  start(pollIntervalMs = 5000): void {
    if (this.#pollTimer) return;
    this.#pollTimer = setInterval(() => this.#tick(), pollIntervalMs);
  }

  /** Stop polling */
  stop(): void {
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
  }

  /** Submit a task for background execution */
  async submit(task: AsyncTask): Promise<void> {
    if (this.#running.size >= this.#maxConcurrent) {
      // Will be picked up by poll when a slot opens
      return;
    }
    this.#executeTask(task);
  }

  /** Cancel a running task */
  cancel(taskId: string): boolean {
    const controller = this.#running.get(taskId);
    if (controller) {
      controller.abort();
      this.#running.delete(taskId);
      this.#store.updateStatus(taskId, "cancelled");
      return true;
    }
    // Maybe it's still pending
    const task = this.#store.getById(taskId);
    if (task && task.status === "pending") {
      this.#store.updateStatus(taskId, "cancelled");
      return true;
    }
    return false;
  }

  /** Get running task count */
  get runningCount(): number {
    return this.#running.size;
  }

  /** Check if a task is currently running */
  isRunning(taskId: string): boolean {
    return this.#running.has(taskId);
  }

  /** Destroy the runner — cancel all running tasks */
  destroy(): void {
    this.#destroyed = true;
    this.stop();
    for (const [id, controller] of this.#running) {
      controller.abort();
      this.#store.updateStatus(id, "cancelled");
    }
    this.#running.clear();
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  async #tick(): Promise<void> {
    if (this.#destroyed) return;
    if (this.#running.size >= this.#maxConcurrent) return;

    const pending = this.#store.listPending(this.#maxConcurrent - this.#running.size);
    for (const task of pending) {
      if (this.#running.size >= this.#maxConcurrent) break;
      this.#executeTask(task);
    }
  }

  async #executeTask(task: AsyncTask): Promise<void> {
    if (this.#destroyed || this.#running.has(task.id)) return;

    const executor = this.#executors.get(task.taskType);
    if (!executor) {
      this.#store.updateStatus(task.id, "failed", {
        error: `No executor registered for task type: ${task.taskType}`,
      });
      this.#notify(task);
      return;
    }

    const controller = new AbortController();
    this.#running.set(task.id, controller);
    this.#store.updateStatus(task.id, "running");

    // Timeout
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.#defaultTimeoutMs);

    try {
      const result = await executor(task);
      clearTimeout(timeout);

      if (this.#destroyed) return;

      if (result.success) {
        this.#store.updateStatus(task.id, "completed", { result: result.result });
      } else {
        this.#store.updateStatus(task.id, "failed", { error: result.error ?? "Unknown error" });
      }
    } catch (err) {
      clearTimeout(timeout);
      if (this.#destroyed) return;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.#store.updateStatus(task.id, "failed", { error: errorMsg });
    } finally {
      this.#running.delete(task.id);
      // Refresh task from store for notification
      const updated = this.#store.getById(task.id);
      if (updated) this.#notify(updated);
    }
  }

  async #notify(task: AsyncTask): Promise<void> {
    for (const cb of this.#notifyCallbacks) {
      try {
        await cb(task, "cli");
      } catch {
        // Don't let notification errors bubble
      }
    }
  }
}

/** Singleton accessor */
let _instance: TaskRunner | null = null;

export function getTaskRunner(store?: TaskStore, options?: TaskRunnerOptions): TaskRunner {
  if (!_instance) {
    _instance = new TaskRunner(store ?? getTaskStore(), options);
  }
  return _instance;
}
