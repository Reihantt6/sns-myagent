// ═══════════════════════════════════════════════════════════════════════════
// Async Task Runner — Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { TaskStore } from "../task-store";
import { TaskRunner } from "../task-runner";
import type { AsyncTask, TaskExecutionResult } from "../types";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let store: TaskStore;
let runner: TaskRunner;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "async-runner-test-"));
  store = new TaskStore(join(tempDir, "test.db"));
  runner = new TaskRunner(store, { maxConcurrent: 2, defaultTimeoutMs: 5000 });
});

afterEach(() => {
  runner.destroy();
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("TaskRunner", () => {
  it("executes task with registered executor", async () => {
    runner.registerExecutor("prompt", async (task: AsyncTask): Promise<TaskExecutionResult> => {
      return { success: true, result: `Done: ${task.description}` };
    });

    const task = store.create({ description: "test exec" });
    let notified = false;
    runner.onNotify((t) => {
      if (t.id === task.id && t.status === "completed") notified = true;
    });

    await runner.submit(task);
    // Wait for async execution
    await new Promise((r) => setTimeout(r, 100));

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("completed");
    expect(updated!.result).toBe("Done: test exec");
    expect(notified).toBe(true);
  });

  it("fails task when executor throws", async () => {
    runner.registerExecutor("prompt", async () => {
      throw new Error("boom");
    });

    const task = store.create({ description: "fail exec" });
    await runner.submit(task);
    await new Promise((r) => setTimeout(r, 100));

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toBe("boom");
  });

  it("fails task when no executor registered", async () => {
    const task = store.create({ description: "no executor", taskType: "shell" });
    await runner.submit(task);
    await new Promise((r) => setTimeout(r, 100));

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toContain("No executor registered");
  });

  it("cancels running task", async () => {
    runner.registerExecutor("prompt", async () => {
      await new Promise((r) => setTimeout(r, 10000));
      return { success: true };
    });

    const task = store.create({ description: "long task" });
    await runner.submit(task);
    await new Promise((r) => setTimeout(r, 50));

    expect(runner.isRunning(task.id)).toBe(true);
    const cancelled = runner.cancel(task.id);
    expect(cancelled).toBe(true);

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("cancelled");
  });

  it("cancels pending task", () => {
    const task = store.create({ description: "pending" });
    const cancelled = runner.cancel(task.id);
    expect(cancelled).toBe(true);

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("cancelled");
  });

  it("respects maxConcurrent limit", async () => {
    const executionOrder: number[] = [];
    runner.registerExecutor("prompt", async (task) => {
      const num = parseInt(task.description);
      executionOrder.push(num);
      await new Promise((r) => setTimeout(r, 50));
      return { success: true, result: `${num}` };
    });

    const tasks = [
      store.create({ description: "1" }),
      store.create({ description: "2" }),
      store.create({ description: "3" }),
    ];

    // Submit all at once — first 2 run immediately, 3rd waits for slot
    for (const t of tasks) {
      await runner.submit(t);
    }
    // Start poll to pick up the 3rd task after a slot opens
    runner.start(50);
    await new Promise((r) => setTimeout(r, 500));
    runner.stop();

    expect(runner.runningCount).toBe(0);
    for (const t of tasks) {
      expect(store.getById(t.id)!.status).toBe("completed");
    }
  });

  it("destroy cancels all running tasks", async () => {
    runner.registerExecutor("prompt", async () => {
      await new Promise((r) => setTimeout(r, 10000));
      return { success: true };
    });

    const task = store.create({ description: "destroy me" });
    await runner.submit(task);
    await new Promise((r) => setTimeout(r, 50));

    expect(runner.runningCount).toBe(1);
    runner.destroy();
    expect(runner.runningCount).toBe(0);
  });

  it("polling picks up pending tasks", async () => {
    runner.registerExecutor("prompt", async (task) => {
      return { success: true, result: `polled: ${task.description}` };
    });

    const task = store.create({ description: "polled task" });
    // Don't submit — let poll pick it up
    runner.start(50);
    await new Promise((r) => setTimeout(r, 200));
    runner.stop();

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("completed");
    expect(updated!.result).toBe("polled: polled task");
  });
});
