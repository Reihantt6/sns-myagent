/**
 * Brand color palette for SNS-MyAgent terminal UI.
 *
 * Orange (#F97316) is the primary brand color.
 * Uses chalk for hex colors, picocolors for basic colors.
 */

import pc from "picocolors";
import chalk from "chalk";

// ── Brand identity colors ──

const ORANGE = "#F97316";

/** Primary brand color — used for headers and highlights. */
export const primary = chalk.hex(ORANGE);

/** Accent color — used for prompts and decorative elements. */
export const accent = chalk.hex(ORANGE);

/** User input text color. */
export const user = pc.white;

/** Agent output text color. */
export const agent = pc.white;

/** System/status messages. */
export const system = pc.gray;

/** Success indicators. */
export const success = pc.green;

/** Warning indicators. */
export const warning = pc.yellow;

/** Error indicators. */
export const error = pc.red;

/** Muted/secondary text. */
export const muted = pc.dim;

/** Bold alias for emphasis. */
export const bold = pc.bold;

// ── Brand gradient constants (for gradient-string) ──

/** Full brand gradient: orange shades. */
export const BRAND_GRADIENT = ["#F97316", "#EA580C", "#FF8C32"];

/** Accent gradient: dark orange → light orange. */
export const ACCENT_GRADIENT = ["#EA580C", "#F97316"];

/** Subtle gradient: orange → amber. */
export const SUBTLE_GRADIENT = ["#F97316", "#F59E0B"];

// ── Role-specific border colors (hex for gradient-string) ──

export const ROLE_HEX = {
  user: "#F97316",
  assistant: "#EA580C",
  tool: "#FFD700",
  system: "#666666",
  error: "#ff4444",
} as const;
