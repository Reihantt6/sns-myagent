// ═══════════════════════════════════════════════════════════════════════════
// Async Task Store — Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { TaskStore } from "../task-store";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let store: TaskStore;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "async-test-"));
  store = new TaskStore(join(tempDir, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("TaskStore", () => {
  it("creates a task with defaults", () => {
    const task = store.create({ description: "test task" });
    expect(task.id).toBeTruthy();
    expect(task.status).toBe("pending");
    expect(task.taskType).toBe("prompt");
    expect(task.description).toBe("test task");
    expect(task.result).toBeNull();
    expect(task.error).toBeNull();
    expect(task.createdAt).toBeGreaterThan(0);
    expect(task.startedAt).toBeNull();
    expect(task.completedAt).toBeNull();
  });

  it("creates a task with custom type and metadata", () => {
    const task = store.create({
      description: "shell task",
      taskType: "shell",
      metadata: { key: "value" },
    });
    expect(task.taskType).toBe("shell");
    expect(task.metadata).toEqual({ key: "value" });
  });

  it("getById returns task", () => {
    const created = store.create({ description: "findable" });
    const found = store.getById(created.id);
    expect(found).toBeTruthy();
    expect(found!.description).toBe("findable");
  });

  it("getById returns null for missing", () => {
    expect(store.getById("nonexistent")).toBeNull();
  });

  it("lists tasks by status", () => {
    store.create({ description: "a" });
    store.create({ description: "b" });
    const task = store.create({ description: "c" });
    store.updateStatus(task.id, "completed", { result: "done" });

    expect(store.list("pending")).toHaveLength(2);
    expect(store.list("completed")).toHaveLength(1);
    expect(store.list()).toHaveLength(3);
  });

  it("transitions to running", () => {
    const task = store.create({ description: "run me" });
    const ok = store.updateStatus(task.id, "running");
    expect(ok).toBe(true);

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("running");
    expect(updated!.startedAt).toBeGreaterThan(0);
  });

  it("transitions to completed with result", () => {
    const task = store.create({ description: "complete me" });
    store.updateStatus(task.id, "running");
    store.updateStatus(task.id, "completed", { result: "all done" });

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("completed");
    expect(updated!.result).toBe("all done");
    expect(updated!.completedAt).toBeGreaterThan(0);
  });

  it("transitions to failed with error", () => {
    const task = store.create({ description: "fail me" });
    store.updateStatus(task.id, "running");
    store.updateStatus(task.id, "failed", { error: "boom" });

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toBe("boom");
  });

  it("transitions to cancelled", () => {
    const task = store.create({ description: "cancel me" });
    store.updateStatus(task.id, "cancelled");

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("cancelled");
  });

  it("delete removes task", () => {
    const task = store.create({ description: "delete me" });
    expect(store.delete(task.id)).toBe(true);
    expect(store.getById(task.id)).toBeNull();
  });

  it("count returns correct totals", () => {
    store.create({ description: "a" });
    store.create({ description: "b" });
    const c = store.create({ description: "c" });
    store.updateStatus(c.id, "completed", { result: "ok" });

    const counts = store.count();
    expect(counts.total).toBe(3);
    expect(counts.pending).toBe(2);
    expect(counts.completed).toBe(1);
    expect(counts.running).toBe(0);
    expect(counts.failed).toBe(0);
  });

  it("listPending returns only pending tasks", () => {
    store.create({ description: "a" });
    const b = store.create({ description: "b" });
    store.updateStatus(b.id, "running");

    expect(store.listPending()).toHaveLength(1);
  });

  it("cleanup removes old completed tasks", () => {
    const task = store.create({ description: "old" });
    store.updateStatus(task.id, "completed", { result: "done" });

    // With maxAge=0, everything should be cleaned
    const cleaned = store.cleanup(0);
    expect(cleaned).toBe(1);
    expect(store.getById(task.id)).toBeNull();
  });
});
