/**
 * Standalone gradient utility for SNS-MyAgent terminal UI.
 *
 * Provides reusable gradient renderers for brand colors.
 * Single source of truth for all gradient-based decorations.
 */
import gradient from "gradient-string";
import chalk from "chalk";
import { BRAND_GRADIENT, ACCENT_GRADIENT, SUBTLE_GRADIENT, ROLE_HEX } from "./colors.js";

// ── Pre-built gradient instances ──

/** Full brand gradient: cyan → purple → pink. */
export const brandGradient: (text: string) => string = gradient(BRAND_GRADIENT);

/** Accent gradient: purple → cyan. */
export const accentGradient: (text: string) => string = gradient(ACCENT_GRADIENT);

/** Subtle gradient: cyan → purple. */
export const subtleGradient: (text: string) => string = gradient(SUBTLE_GRADIENT);

// ── Gradient functions ──

/**
 * Apply brand gradient to text.
 */
export function brand(text: string): string {
  return brandGradient(text);
}

/**
 * Apply accent gradient to text.
 */
export function accentGrad(text: string): string {
  return accentGradient(text);
}

/**
 * Apply subtle gradient to text.
 */
export function subtle(text: string): string {
  return subtleGradient(text);
}

/**
 * Create a gradient border line spanning the given width.
 */
export function gradientLine(width: number): string {
  const line = "─".repeat(width);
  return brandGradient(line);
}

/**
 * Create a gradient border with label in the center.
 */
export function labeledGradientLine(label: string, width: number): string {
  const labelLen = label.length + 4; // 2 spaces each side
  const sideLen = Math.max(0, Math.floor((width - labelLen) / 2));
  const left = "─".repeat(sideLen);
  const right = "─".repeat(width - sideLen - labelLen);
  return brandGradient(left) + chalk.dim(` ${label} `) + brandGradient(right);
}

/**
 * Create a role-specific gradient for a message role.
 */
export function roleGradient(role: keyof typeof ROLE_HEX): (text: string) => string {
  const hex = ROLE_HEX[role];
  const darker = adjustBrightness(hex, -30);
  return gradient([hex, darker]);
}

/**
 * Create a gradient for status indicators.
 */
export function statusGradient(status: "success" | "warning" | "error" | "info"): (text: string) => string {
  switch (status) {
    case "success":
      return gradient(["#00d2ff", "#00ff88"]);
    case "warning":
      return gradient(["#ffd700", "#ff8c00"]);
    case "error":
      return gradient(["#ff4444", "#cc0000"]);
    case "info":
      return gradient(["#00d2ff", "#7b2ff7"]);
  }
}

/**
 * Render text with a gradient background (using chalk bg).
 */
export function gradientBg(text: string, hex: string): string {
  return chalk.bgHex(hex)(text);
}

// ── Internal helpers ──

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
