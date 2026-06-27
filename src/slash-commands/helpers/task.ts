// ═══════════════════════════════════════════════════════════════════════════
// /task slash command handler
// ═══════════════════════════════════════════════════════════════════════════

import { getTaskStore } from "../../async/task-store";
import { getTaskRunner } from "../../async/task-runner";
import { formatTaskList, formatTaskStatus, cliNotify } from "../../async/notifier";
import type { ParsedSlashCommand, SlashCommandResult, SlashCommandRuntime } from "../types";
import { parseSubcommand } from "./parse";

/**
 * Handle /task subcommands: run, list, status, cancel, result.
 */
export async function handleTaskCommand(
  command: ParsedSlashCommand,
  runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
  const { verb, rest } = parseSubcommand(command.args);
  const store = getTaskStore();

  switch (verb) {
    case "run":
      return taskRun(rest, store, runtime);
    case "list":
    case "ls":
      return taskList(store, runtime);
    case "status":
      return taskStatus(rest, store, runtime);
    case "cancel":
    case "stop":
      return taskCancel(rest, store, runtime);
    case "result":
    case "out":
      return taskResult(rest, store, runtime);
    default:
      await runtime.output(
        `Usage: /task <subcommand>\n` +
          `  run <description>    Spawn async task in background\n` +
          `  list                 Show all tasks (pending + running)\n` +
          `  status <id>          Check specific task status\n` +
          `  cancel <id>          Cancel running/pending task\n` +
          `  result <id>          Get full task result\n`,
      );
      return { consumed: true };
  }
}

async function taskRun(
  description: string,
  store: ReturnType<typeof getTaskStore>,
  runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
  if (!description.trim()) {
    await runtime.output("Usage: /task run <description>");
    return { consumed: true };
  }

  const task = store.create({ description: description.trim() });
  const runner = getTaskRunner(store);

  // Register a default prompt executor (idempotent — overwrites if exists)
  runner.registerExecutor("prompt", async (t) => {
    // Default executor: simulate work (real executor wired by agent session)
    return { success: true, result: `Task "${t.description}" completed by default executor.` };
  });

  runner.start();
  await runner.submit(task);

  await runtime.output(
    `✅ Task created: ${task.id.slice(0, 8)}\n` +
      `   Description: ${task.description}\n` +
      `   Status: pending → running in background\n` +
      `   Check: /task status ${task.id.slice(0, 8)}`,
  );
  return { consumed: true };
}

async function taskList(
  store: ReturnType<typeof getTaskStore>,
  runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
  const active = store.list("running");
  const pending = store.list("pending", 10);
  const recent = store.list("completed", 5);

  const tasks = [...active, ...pending, ...recent];
  await runtime.output(formatTaskList(tasks));

  const counts = store.count();
  await runtime.output(
    `Total: ${counts.total} | Pending: ${counts.pending} | Running: ${counts.running} | Done: ${counts.completed} | Failed: ${counts.failed}`,
  );
  return { consumed: true };
}

async function taskStatus(
  idPrefix: string,
  store: ReturnType<typeof getTaskStore>,
  runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
  const id = idPrefix.trim();
  if (!id) {
    await runtime.output("Usage: /task status <id>");
    return { consumed: true };
  }

  const task = findTaskByIdPrefix(store, id);
  if (!task) {
    await runtime.output(`Task not found: ${id}`);
    return { consumed: true };
  }

  await runtime.output(formatTaskStatus(task));
  return { consumed: true };
}

async function taskCancel(
  idPrefix: string,
  store: ReturnType<typeof getTaskStore>,
  runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
  const id = idPrefix.trim();
  if (!id) {
    await runtime.output("Usage: /task cancel <id>");
    return { consumed: true };
  }

  const task = findTaskByIdPrefix(store, id);
  if (!task) {
    await runtime.output(`Task not found: ${id}`);
    return { consumed: true };
  }

  const runner = getTaskRunner(store);
  const cancelled = runner.cancel(task.id);
  if (cancelled) {
    await runtime.output(`🚫 Task ${task.id.slice(0, 8)} cancelled.`);
  } else {
    await runtime.output(`Task ${task.id.slice(0, 8)} is already ${task.status}, cannot cancel.`);
  }
  return { consumed: true };
}

async function taskResult(
  idPrefix: string,
  store: ReturnType<typeof getTaskStore>,
  runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
  const id = idPrefix.trim();
  if (!id) {
    await runtime.output("Usage: /task result <id>");
    return { consumed: true };
  }

  const task = findTaskByIdPrefix(store, id);
  if (!task) {
    await runtime.output(`Task not found: ${id}`);
    return { consumed: true };
  }

  if (task.status === "completed" && task.result) {
    await runtime.output(`Result for ${task.id.slice(0, 8)}:\n${task.result}`);
  } else if (task.status === "failed" && task.error) {
    await runtime.output(`Error for ${task.id.slice(0, 8)}:\n${task.error}`);
  } else {
    await runtime.output(`Task ${task.id.slice(0, 8)} is ${task.status} — no result yet.`);
  }
  return { consumed: true };
}

/** Find task by full ID or prefix (first 8 chars) */
function findTaskByIdPrefix(store: ReturnType<typeof getTaskStore>, prefix: string) {
  // Try full ID first
  const full = store.getById(prefix);
  if (full) return full;

  // Try prefix match — search all recent tasks
  const all = store.list(undefined, 100);
  return all.find((t) => t.id.startsWith(prefix)) ?? null;
}
