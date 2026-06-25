// ═══════════════════════════════════════════════════════════════════════════
// Cron Expression Parser
//
// Parses standard 5-field cron expressions: min hour day month weekday
// Supports: *, */n, n, n-m, n,m,o
// ═══════════════════════════════════════════════════════════════════════════

import type { CronExpression } from "./types";

const FIELD_RANGES = {
 minute: { min: 0, max: 59 },
 hour: { min: 0, max: 23 },
 dayOfMonth: { min: 1, max: 31 },
 month: { min: 1, max: 12 },
 dayOfWeek: { min: 0, max: 7 },
} as const;

const FIELD_NAMES: (keyof typeof FIELD_RANGES)[] = [
 "minute",
 "hour",
 "dayOfMonth",
 "month",
 "dayOfWeek",
];

/**
 * Parse a standard 5-field cron expression string.
 * Throws on invalid expressions.
 */
export function parseCronExpression(expr: string): CronExpression {
 const parts = expr.trim().split(/\s+/);
 if (parts.length !== 5) {
  throw new Error(
   `Invalid cron expression: expected 5 fields, got ${parts.length}. Format: minute hour day month weekday`,
  );
 }

 const result: Record<string, string> = {};
 for (let i = 0; i < 5; i++) {
  const fieldName = FIELD_NAMES[i];
  validateField(fieldName, parts[i]);
  result[fieldName] = parts[i];
 }

 return result as unknown as CronExpression;
}

/**
 * Validate a single cron field.
 */
function validateField(field: keyof typeof FIELD_RANGES, value: string): void {
 const range = FIELD_RANGES[field];

 // Split on commas for list fields: 1,3,5
 const items = value.split(",");

 for (const item of items) {
  // Handle step: */2, 1-30/5
  const [rangePart, step] = item.split("/");

  if (step !== undefined) {
   const stepNum = parseInt(step, 10);
   if (isNaN(stepNum) || stepNum < 1) {
    throw new Error(`Invalid step "${step}" in cron field "${field}"`);
   }
  }

  if (rangePart === "*") {
   continue;
  }

  // Handle range: 1-5
  if (rangePart.includes("-")) {
   const [start, end] = rangePart.split("-");
   const startNum = parseInt(start, 10);
   const endNum = parseInt(end, 10);
   if (isNaN(startNum) || isNaN(endNum)) {
    throw new Error(`Invalid range "${rangePart}" in cron field "${field}"`);
   }
   if (startNum < range.min || startNum > range.max) {
    throw new Error(
     `Range start ${startNum} out of range [${range.min}-${range.max}] for field "${field}"`,
    );
   }
   if (endNum < range.min || endNum > range.max) {
    throw new Error(
     `Range end ${endNum} out of range [${range.min}-${range.max}] for field "${field}"`,
    );
   }
   if (startNum > endNum) {
    throw new Error(
     `Range start ${startNum} > end ${endNum} in cron field "${field}"`,
    );
   }
   continue;
  }

  // Plain number
  const num = parseInt(rangePart, 10);
  if (isNaN(num)) {
   throw new Error(`Invalid value "${rangePart}" in cron field "${field}"`);
  }
  if (num < range.min || num > range.max) {
   throw new Error(
    `Value ${num} out of range [${range.min}-${range.max}] for field "${field}"`,
   );
  }
 }
}

/**
 * Check if a cron expression matches a given Date.
 */
export function cronMatches(expr: CronExpression, date: Date): boolean {
 const minute = date.getMinutes();
 const hour = date.getHours();
 const dayOfMonth = date.getDate();
 const month = date.getMonth() + 1; // 0-indexed → 1-indexed
 const dayOfWeek = date.getDay(); // 0=Sunday

 return (
  fieldMatches(expr.minute, minute, 0, 59) &&
  fieldMatches(expr.hour, hour, 0, 23) &&
  fieldMatches(expr.dayOfMonth, dayOfMonth, 1, 31) &&
  fieldMatches(expr.month, month, 1, 12) &&
  fieldMatches(expr.dayOfWeek, dayOfWeek, 0, 7)
 );
}

/**
 * Check if a single cron field matches a numeric value.
 */
function fieldMatches(
 field: string,
 value: number,
 min: number,
 max: number,
): boolean {
 const items = field.split(",");

 for (const item of items) {
  const [rangePart, step] = item.split("/");
  const stepVal = step !== undefined ? parseInt(step, 10) : 1;

  if (rangePart === "*") {
   if ((value - min) % stepVal === 0) return true;
   continue;
  }

  if (rangePart.includes("-")) {
   const [startStr, endStr] = rangePart.split("-");
   const start = parseInt(startStr, 10);
   const end = parseInt(endStr, 10);
   if (value >= start && value <= end && (value - start) % stepVal === 0)
    return true;
   continue;
  }

  if (parseInt(rangePart, 10) === value) return true;
 }

 return false;
}

/**
 * Compute the next run time for a cron expression, starting from the given date.
 * Returns a Date or null if no match found within 366 days.
 */
export function getNextCronRun(expr: CronExpression, from: Date): Date | null {
 // Start from the next minute boundary
 const candidate = new Date(from);
 candidate.setSeconds(0, 0);
 candidate.setMinutes(candidate.getMinutes() + 1);

 // Limit search to ~366 days to avoid infinite loops
 const limit = new Date(candidate);
 limit.setFullYear(limit.getFullYear() + 1);

 while (candidate < limit) {
  if (cronMatches(expr, candidate)) {
   return new Date(candidate);
  }
  candidate.setMinutes(candidate.getMinutes() + 1);
 }

 return null;
}

/**
 * Human-readable summary of a cron expression.
 */
export function describeCron(expr: CronExpression): string {
 const parts: string[] = [];

 if (expr.minute === "0" && expr.hour === "*") {
  parts.push("every hour");
 } else if (expr.minute.includes("*/")) {
  parts.push(`every ${expr.minute.replace("*/", "")} minutes`);
 } else {
  parts.push(`at minute ${expr.minute}`);
 }

 if (expr.hour !== "*") {
  if (expr.hour.includes("*/")) {
   parts.push(`every ${expr.hour.replace("*/", "")} hours`);
  } else {
   parts.push(`at hour ${expr.hour}`);
  }
 }

 if (expr.dayOfMonth !== "*") parts.push(`on day ${expr.dayOfMonth}`);
 if (expr.month !== "*") parts.push(`in month ${expr.month}`);

 if (expr.dayOfWeek !== "*") {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (expr.dayOfWeek.includes(",")) {
   const days = expr.dayOfWeek
    .split(",")
    .map((d) => dayNames[parseInt(d, 10)] ?? d)
    .join(", ");
   parts.push(`on ${days}`);
  } else {
   parts.push(`on ${dayNames[parseInt(expr.dayOfWeek, 10)] ?? expr.dayOfWeek}`);
  }
 }

 return parts.join(", ");
}
