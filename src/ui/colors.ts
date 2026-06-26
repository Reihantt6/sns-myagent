/**
 * Brand color palette for SNS-MyAgent terminal UI.
 *
 * Uses picocolors for zero-dependency color output.
 * Brand gradient: #00d2ff → #7b2ff7 → #ff6b9d
 */

import pc from "picocolors";

// ── Brand identity colors ──

/** Primary brand color — used for headers and highlights. */
export const primary = pc.cyan;

/** Accent color — used for prompts and decorative elements. */
export const accent = pc.magenta;

/** User input text color. */
export const user = pc.blue;

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

/** Full brand gradient: cyan → purple → pink. */
export const BRAND_GRADIENT = ["#00d2ff", "#7b2ff7", "#ff6b9d"];

/** Accent gradient: purple → cyan. */
export const ACCENT_GRADIENT = ["#7b2ff7", "#00d2ff"];

/** Subtle gradient: cyan → purple. */
export const SUBTLE_GRADIENT = ["#00d2ff", "#7b2ff7"];

// ── Role-specific border colors (hex for gradient-string) ──

export const ROLE_HEX = {
  user: "#00d2ff",
  assistant: "#7b2ff7",
  tool: "#ffd700",
  system: "#666666",
  error: "#ff4444",
} as const;
