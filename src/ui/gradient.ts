/**
 * Minimal palette for SNS-MyAgent TUI.
 *
 * One accent color (cyan) for prompts and brand. Everything else uses
 * terminal defaults + chalk.dim for secondary text. No gradients, no
 * 4-role color explosion — the terminal is for reading, not for show.
 */

import chalk from "chalk";

/** Single accent for prompts, brand, and focus. */
export const accent = chalk.cyan;

/** Brand text — bold cyan, no rainbow. */
export const brand = (s: string) => chalk.cyan.bold(s);

/** Subtle / dimmed text. */
export const subtle = chalk.dim;

/** Stronger emphasis than subtle. */
export const muted = chalk.gray;

/** Accent for inline emphasis (e.g. file paths, ids). */
export const inline = chalk.cyan;
