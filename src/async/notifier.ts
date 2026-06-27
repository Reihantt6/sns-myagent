// ═══════════════════════════════════════════════════════════════════════════
// Async Task Notifier — notification dispatch (CLI + Telegram)
// ═══════════════════════════════════════════════════════════════════════════

import type { AsyncTask, NotifyCallback, NotifyChannel } from "./types";
import chalk from "chalk";
import gradient from "gradient-string";

const STATUS_COLORS: Record<string, (text: string) => string> = {
  completed: (t) => chalk.green(t),
  failed: (t) => chalk.red(t),
  cancelled: (t) => chalk.yellow(t),
  running: (t) => chalk.cyan(t),
  pending: (t) => chalk.dim(t),
};

const STATUS_EMOJI: Record<string, string> = {
  completed: "✅",
  failed: "❌",
  cancelled: "🚫",
  running: "⏳",
  pending: "⏸️",
};

function truncate(text: string | null, maxLen = 200): string {
  if (!text) return "(no output)";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

function formatDuration(startMs: number | null, endMs: number | null): string {
  if (!startMs) return "";
  const end = endMs ?? Date.now();
  const duration = end - startMs;
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${Math.floor(duration / 60000)}m ${Math.round((duration % 60000) / 1000)}s`;
}

/** CLI notification — renders styled block in terminal */
export const cliNotify: NotifyCallback = (task: AsyncTask, _channel: NotifyChannel) => {
  const emoji = STATUS_EMOJI[task.status] ?? "❓";
  const colorFn = STATUS_COLORS[task.status] ?? chalk.white;
  const duration = formatDuration(task.startedAt, task.completedAt);

  const header = `${emoji} Task ${task.id.slice(0, 8)} — ${colorFn(task.status.toUpperCase())}`;
  const desc = `   ${chalk.dim("Description:")} ${task.description}`;
  const time = duration ? `   ${chalk.dim("Duration:")} ${duration}` : "";

  console.log("");
  console.log(chalk.bold(header));
  console.log(desc);
  if (time) console.log(time);

  if (task.status === "completed" && task.result) {
    console.log(`   ${chalk.dim("Result:")} ${truncate(task.result)}`);
  }
  if (task.status === "failed" && task.error) {
    console.log(`   ${chalk.dim("Error:")} ${chalk.red(truncate(task.error))}`);
  }
  console.log("");
};

/** Telegram notification — formats message for MarkdownV2 */
export function formatTelegramNotify(task: AsyncTask): string {
  const emoji = STATUS_EMOJI[task.status] ?? "❓";
  const duration = formatDuration(task.startedAt, task.completedAt);

  let msg = `${emoji} *Task ${task.id.slice(0, 8)}* — ${task.status.toUpperCase()}\n`;
  msg += `📋 ${task.description}\n`;
  if (duration) msg += `⏱ ${duration}\n`;

  if (task.status === "completed" && task.result) {
    msg += `\n📄 Result:\n\`\`\`\n${truncate(task.result, 500)}\n\`\`\``;
  }
  if (task.status === "failed" && task.error) {
    msg += `\n❌ Error: ${truncate(task.error, 300)}`;
  }

  return msg;
}

/** Format task list for display */
export function formatTaskList(tasks: AsyncTask[]): string {
  if (tasks.length === 0) return chalk.dim("No tasks found.");

  const lines = [chalk.bold("Async Tasks:"), ""];

  for (const task of tasks) {
    const emoji = STATUS_EMOJI[task.status] ?? "❓";
    const colorFn = STATUS_COLORS[task.status] ?? chalk.white;
    const duration = formatDuration(task.startedAt, task.completedAt);
    const age = formatAge(task.createdAt);

    lines.push(
      `  ${emoji} ${chalk.bold(task.id.slice(0, 8))} ${colorFn(task.status.padEnd(10))} ${age} ${duration ? chalk.dim(`(${duration})`) : ""}`,
    );
    lines.push(`     ${task.description}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Format single task status */
export function formatTaskStatus(task: AsyncTask): string {
  const emoji = STATUS_EMOJI[task.status] ?? "❓";
  const colorFn = STATUS_COLORS[task.status] ?? chalk.white;
  const duration = formatDuration(task.startedAt, task.completedAt);

  const lines = [
    chalk.bold(`${emoji} Task ${task.id}`),
    `  Status:      ${colorFn(task.status)}`,
    `  Description: ${task.description}`,
    `  Type:        ${task.taskType}`,
    `  Created:     ${new Date(task.createdAt).toISOString()}`,
  ];

  if (task.startedAt) lines.push(`  Started:     ${new Date(task.startedAt).toISOString()}`);
  if (task.completedAt) lines.push(`  Completed:   ${new Date(task.completedAt).toISOString()}`);
  if (duration) lines.push(`  Duration:    ${duration}`);
  if (task.result) lines.push(`  Result:      ${truncate(task.result, 300)}`);
  if (task.error) lines.push(`  Error:       ${chalk.red(truncate(task.error, 300))}`);

  return lines.join("\n");
}

function formatAge(createdAt: number): string {
  const diff = Date.now() - createdAt;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
