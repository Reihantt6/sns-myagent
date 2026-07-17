/**
 * Styled chat input prompt for SNS-MyAgent.
 *
 * Provides the `snsagent >` prompt with accent coloring.
 * Uses Node's readline for cross-platform input.
 */

import * as readline from "node:readline";
import { accent, muted } from "./colors.js";

/**
 * Create a readline-based prompt and return an async generator
 * that yields each line of user input.
 */
export function createPrompt(): {
	question: (prefix?: string) => Promise<string>;
	close: () => void;
	rl: readline.Interface;
} {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: accent("snsagent") + muted(" > "),
	});

	return {
		question: (prefix?: string) =>
			new Promise<string>((resolve) => {
				rl.question(prefix ?? "", (answer) => resolve(answer));
			}),
		close: () => rl.close(),
		rl,
	};
}
