// ═══════════════════════════════════════════════════════════════════════════
// /cron slash command handler
// ═══════════════════════════════════════════════════════════════════════════

import { parseCronExpression, describeCron } from "../../cron/cron-parser";
import { getCronScheduler } from "../../cron/cron-scheduler";
import type { CronJob, JobAction } from "../../cron/types";
import type { ParsedSlashCommand, SlashCommandResult, SlashCommandRuntime } from "../types";
import { errorMessage, parseSubcommand } from "./parse";

/**
 * Handle /cron subcommands: list, add, remove, run, status, enable, disable.
 */
export async function handleCronCommand(
 command: ParsedSlashCommand,
 runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
 const { verb, rest } = parseSubcommand(command.args);
 const scheduler = getCronScheduler();

 switch (verb) {
  case "list":
   return cronList(scheduler, runtime);
  case "add":
   return cronAdd(rest, scheduler, runtime);
  case "remove":
  case "rm":
   return cronRemove(rest, scheduler, runtime);
  case "run":
   return cronRun(rest, scheduler, runtime);
  case "status":
   return cronStatus(scheduler, runtime);
  case "enable":
   return cronEnableScheduler(runtime);
  case "disable":
   return cronDisableScheduler(runtime);
  default:
   await runtime.output(
    `Usage: /cron <subcommand>\n` +
     `  list          List all cron jobs\n` +
     `  add           Add a new cron job: /cron add <name> <cron> <type> <action>\n` +
     `  remove <id>   Remove a cron job\n` +
     `  run <id>      Manually trigger a job\n` +
     `  status        Show scheduler status\n` +
     `  enable        Enable the cron scheduler\n` +
     `  disable       Disable the cron scheduler\n\n` +
     `Types: prompt, shell, skill\n` +
     `Cron format: min hour day month weekday (standard 5-field)\n` +
     `Examples:\n` +
     `  /cron add backup "0 2 * * *" shell "git push origin main"\n` +
     `  /cron add check-health "*/30 * * * *" shell "curl -sf http://localhost:3000/health"\n` +
     `  /cron add daily-summary "0 9 * * *" prompt "Summarize yesterday's work"`,
   );
   return { consumed: true };
 }
}

function cronList(
 scheduler: ReturnType<typeof getCronScheduler>,
 runtime: SlashCommandRuntime,
): SlashCommandResult {
 const jobs = scheduler.listJobs();

 if (jobs.length === 0) {
  runtime.output("No cron jobs configured. Use /cron add to create one.");
  return { consumed: true };
 }

 const lines = ["Cron Jobs:", ""];
 for (const job of jobs) {
  const status = job.enabled ? "active" : "paused";
  const nextRun = job.nextRunAt
   ? new Date(job.nextRunAt).toLocaleString()
   : "n/a";
  const actionDesc = describeAction(job.action);
  const scheduleDesc = scheduler.describeSchedule(job.cron);

  lines.push(
   `  [${status}] ${job.name} (${job.id.slice(0, 8)})`,
   `    Schedule: ${job.cron} (${scheduleDesc})`,
   `    Action: ${actionDesc}`,
   `    Next run: ${nextRun}`,
   "",
  );
 }

 lines.push(`${jobs.length} job(s) total.`);
 runtime.output(lines.join("\n"));
 return { consumed: true };
}

function cronAdd(
 args: string,
 scheduler: ReturnType<typeof getCronScheduler>,
 runtime: SlashCommandRuntime,
): SlashCommandResult {
 // Parse: <name> <cron-expr> <type> <action>
 const tokens = parseAddArgs(args);
 if (!tokens) {
  runtime.output(
   `Usage: /cron add <name> <cron-expr> <type> <action>\n` +
     `  type: prompt | shell | skill\n` +
     `  Examples:\n` +
     `    /cron add backup "0 2 * * *" shell "git push"\n` +
     `    /cron add remind "0 9 * * 1-5" prompt "Standup in 15 min"`,
  );
  return { consumed: true };
 }

 const { name, cron, type, action } = tokens;

 // Validate cron expression
 try {
  parseCronExpression(cron);
 } catch (err) {
  runtime.output(`Invalid cron expression: ${errorMessage(err)}`);
  return { consumed: true };
 }

 // Build action
 let jobAction: JobAction;
 switch (type) {
  case "prompt":
   jobAction = { type: "prompt", prompt: action };
   break;
  case "shell":
   jobAction = { type: "shell", command: action };
   break;
  case "skill":
   jobAction = { type: "skill", skillName: action };
   break;
  default:
   runtime.output(
    `Unknown action type "${type}". Use: prompt, shell, or skill.`,
   );
   return { consumed: true };
 }

 const job = scheduler.addJob(name, cron, jobAction);
 const scheduleDesc = scheduler.describeSchedule(job.cron);
 const nextRun = job.nextRunAt
  ? new Date(job.nextRunAt).toLocaleString()
  : "n/a";

 runtime.output(
  `Job created: ${job.name} (${job.id.slice(0, 8)})\n` +
   `  Schedule: ${job.cron} (${scheduleDesc})\n` +
   `  Next run: ${nextRun}`,
 );
 return { consumed: true };
}

function cronRemove(
 id: string,
 scheduler: ReturnType<typeof getCronScheduler>,
 runtime: SlashCommandRuntime,
): SlashCommandResult {
 const trimmed = id.trim();
 if (!trimmed) {
  runtime.output("Usage: /cron remove <job-id-or-name>");
  return { consumed: true };
 }

 // Try direct ID first
 let removed = scheduler.removeJob(trimmed);

 // Try matching by name prefix if not found
 if (!removed) {
  const jobs = scheduler.listJobs();
  const match = jobs.find(
   (j) => j.id.startsWith(trimmed) || j.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (match) {
   removed = scheduler.removeJob(match.id);
  }
 }

 if (removed) {
  runtime.output("Job removed.");
 } else {
  runtime.output(`No job found matching "${trimmed}".`);
 }
 return { consumed: true };
}

async function cronRun(
 id: string,
 scheduler: ReturnType<typeof getCronScheduler>,
 runtime: SlashCommandRuntime,
): Promise<SlashCommandResult> {
 const trimmed = id.trim();
 if (!trimmed) {
  runtime.output("Usage: /cron run <job-id-or-name>");
  return { consumed: true };
 }

 // Find job by ID prefix or name
 let job = scheduler.getJob(trimmed);
 if (!job) {
  const jobs = scheduler.listJobs();
  job = jobs.find(
   (j) => j.id.startsWith(trimmed) || j.name.toLowerCase() === trimmed.toLowerCase(),
  ) ?? null;
 }

 if (!job) {
  runtime.output(`No job found matching "${trimmed}".`);
  return { consumed: true };
 }

 runtime.output(`Running job "${job.name}"...`);
 const exec = await scheduler.triggerJob(job.id!);

 if (exec.success) {
  const duration = exec.completedAt - exec.startedAt;
  const output = exec.output ? `\n  Output: ${exec.output}` : "";
  runtime.output(`Job "${job.name}" completed in ${duration}ms.${output}`);
 } else {
  runtime.output(
   `Job "${job.name}" failed: ${exec.error ?? "unknown error"}`,
  );
 }
 return { consumed: true };
}

function cronStatus(
 scheduler: ReturnType<typeof getCronScheduler>,
 runtime: SlashCommandRuntime,
): SlashCommandResult {
 const jobs = scheduler.listJobs();
 const enabledCount = jobs.filter((j) => j.enabled).length;
 const running = scheduler.isRunning();

 runtime.output(
  `Cron Scheduler Status\n` +
   `  Running: ${running ? "yes" : "no"}\n` +
   `  Total jobs: ${jobs.length}\n` +
   `  Active jobs: ${enabledCount}\n` +
   `  Paused jobs: ${jobs.length - enabledCount}`,
 );
 return { consumed: true };
}

function cronEnableScheduler(
 runtime: SlashCommandRuntime,
): SlashCommandResult {
 runtime.settings.set("cron.enabled", true);
 const scheduler = getCronScheduler();
 scheduler.start();
 runtime.output("Cron scheduler enabled and started.");
 return { consumed: true };
}

function cronDisableScheduler(
 runtime: SlashCommandRuntime,
): SlashCommandResult {
 runtime.settings.set("cron.enabled", false);
 const scheduler = getCronScheduler();
 scheduler.stop();
 runtime.output("Cron scheduler disabled and stopped.");
 return { consumed: true };
}

// ── Helpers ─────────────────────────────────────────────────────────

function describeAction(action: JobAction): string {
 switch (action.type) {
  case "prompt":
   return `prompt: ${action.prompt}`;
  case "shell":
   return `shell: ${action.command}`;
  case "skill":
   return `skill: ${action.skillName}${action.args ? ` ${action.args}` : ""}`;
 }
}

function parseAddArgs(
 args: string,
): { name: string; cron: string; type: string; action: string } | null {
 const trimmed = args.trim();
 if (!trimmed) return null;

 // Extract name (first token or quoted string)
 let rest: string;
 let name: string;

 if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
  const quote = trimmed[0];
  const closeIdx = trimmed.indexOf(quote, 1);
  if (closeIdx === -1) return null;
  name = trimmed.slice(1, closeIdx);
  rest = trimmed.slice(closeIdx + 1).trim();
 } else {
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return null;
  name = trimmed.slice(0, spaceIdx);
  rest = trimmed.slice(spaceIdx + 1).trim();
 }

 // Extract cron expression (quoted or unquoted)
 let cron: string;
 if (rest.startsWith('"') || rest.startsWith("'")) {
  const quote = rest[0];
  const closeIdx = rest.indexOf(quote, 1);
  if (closeIdx === -1) return null;
  cron = rest.slice(1, closeIdx);
  rest = rest.slice(closeIdx + 1).trim();
 } else {
  // Cron has 5 space-separated fields; grab first 5 tokens
  const parts = rest.split(/\s+/);
  if (parts.length < 5) return null;
  // But the cron expr might be part of a larger string, let's try to extract
  // the 5-field cron and the rest
  // Use a regex approach: find 5 cron-like fields
  const cronMatch = rest.match(/^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)/);
  if (!cronMatch) return null;
  cron = cronMatch[1];
  rest = cronMatch[2].trim();
 }

 // Extract type
 const typeMatch = rest.match(/^(prompt|shell|skill)\s+(.+)/);
 if (!typeMatch) return null;

 return {
  name,
  cron,
  type: typeMatch[1],
  action: typeMatch[2],
 };
}
