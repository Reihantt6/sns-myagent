/**
 * Spinner utility for SNS-MyAgent.
 *
 * Wraps ora with task-specific text.
 */

import ora, { type Ora } from "ora";

/**
 * Create and start a spinner with the given text.
 * Returns the ora instance; call `.succeed()`, `.fail()`, or `.stop()` when done.
 */
export function createSpinner(text: string): Ora {
	return ora({ text, color: "magenta" }).start();
}
