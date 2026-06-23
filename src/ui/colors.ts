/**
 * Brand color palette for SNS-MyAgent terminal UI.
 *
 * Uses picocolors for zero-dependency color output.
 */

import pc from "picocolors";

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
