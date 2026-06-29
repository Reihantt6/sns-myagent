/**
 * Premium error display component for SNS-MyAgent terminal UI.
 *
 * Renders errors in styled bordered blocks with gradient accents.
 * Supports error hierarchy: main error + optional cause chain.
 */
import chalk from "chalk";
import gradient from "gradient-string";
import boxen from "boxen";
import { BRAND_GRADIENT, ROLE_HEX } from "./colors.js";

const ERROR_GRADIENT = [ROLE_HEX.error, "#cc0000"] as const;
const WARN_GRADIENT = ["#ffd700", "#ff8c00"] as const;

export type ErrorSeverity = "error" | "warning" | "info";

export interface ErrorDisplayOptions {
  /** Error title / short description. */
  title: string;
  /** Detailed error message. */
  message: string;
  /** Error code (e.g., "E001", "HTTP_404"). */
  code?: string;
  /** Severity level. */
  severity?: ErrorSeverity;
  /** Stack trace (shown collapsed). */
  stack?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
  /** Additional context lines. */
  context?: string[];
}

function getSeverityColors(severity: ErrorSeverity) {
  switch (severity) {
    case "error":
      return { border: "red" as const, gradient: [...ERROR_GRADIENT], icon: "✗", label: "ERROR" };
    case "warning":
      return { border: "yellow" as const, gradient: [...WARN_GRADIENT], icon: "⚠", label: "WARNING" };
    case "info":
      return { border: "cyan" as const, gradient: ["#00d2ff", "#7b2ff7"] as [string, string], icon: "ℹ", label: "INFO" };
  }
}

/**
 * Render an error display block.
 */
export function renderErrorDisplay(opts: ErrorDisplayOptions): string {
  const severity = opts.severity ?? "error";
  const colors = getSeverityColors(severity);
  const grad = gradient(colors.gradient);
  const cols = process.stdout.columns ?? 80;
  const width = Math.min(cols - 2, 72);

  const lines: string[] = [];

  // ── Header ──
  const headerIcon = severity === "error"
    ? chalk.red.bold(colors.icon)
    : severity === "warning"
    ? chalk.yellow.bold(colors.icon)
    : chalk.cyan(colors.icon);
  const headerLabel = grad(` ${colors.label} `);
  const codeStr = opts.code ? chalk.dim(` [${opts.code}]`) : "";
  lines.push(`${headerIcon} ${headerLabel}${codeStr}`);

  // ── Title ──
  lines.push("");
  lines.push(chalk.bold.white(opts.title));

  // ── Message ──
  lines.push("");
  const msgLines = opts.message.split("\n");
  for (const line of msgLines) {
    lines.push(chalk.white(line));
  }

  // ── Context lines ──
  if (opts.context && opts.context.length > 0) {
    lines.push("");
    lines.push(chalk.dim("Context:"));
    for (const ctx of opts.context.slice(0, 5)) {
      lines.push(chalk.dim(`  ${ctx}`));
    }
    if (opts.context.length > 5) {
      lines.push(chalk.dim(`  ... +${opts.context.length - 5} more`));
    }
  }

  // ── Suggestion ──
  if (opts.suggestion) {
    lines.push("");
    lines.push(`${chalk.green("💡")} ${chalk.green.bold("Suggestion:")}`);
    lines.push(chalk.green(`  ${opts.suggestion}`));
  }

  // ── Stack trace (collapsed preview) ──
  if (opts.stack) {
    lines.push("");
    const stackLines = opts.stack.split("\n").slice(0, 3);
    lines.push(chalk.dim("Stack trace (first 3 lines):"));
    for (const sl of stackLines) {
      lines.push(chalk.dim(`  ${sl.trim()}`));
    }
  }

  // ── Render in boxen ──
  const content = lines.join("\n");
  return boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: colors.border,
    width,
  });
}

/**
 * Quick error render — wraps a simple error message in a styled block.
 */
export function renderQuickError(title: string, message: string): string {
  return renderErrorDisplay({ title, message, severity: "error" });
}

/**
 * Render a warning display.
 */
export function renderWarning(title: string, message: string, suggestion?: string): string {
  return renderErrorDisplay({ title, message, severity: "warning", suggestion });
}
