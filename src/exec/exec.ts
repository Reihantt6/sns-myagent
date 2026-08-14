/**
 * Shared command execution utilities for hooks and custom tools.
 */
import { ptree } from "@oh-my-pi/pi-utils";

/**
 * Options for executing shell commands.
 */
export interface ExecOptions {
	/** AbortSignal to cancel the command */
	signal?: AbortSignal;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Working directory */
	cwd?: string;
}

/**
 * Result of executing a shell command.
 */
export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
	killed: boolean;
}

/**
 * Execute a shell command and return stdout/stderr/code.
 * Supports timeout and abort signal.
 */
export async function execCommand(
	command: string,
	args: string[],
	cwd: string,
	options?: ExecOptions,
): Promise<ExecResult> {
	const result = await ptree.exec([command, ...args], {
		cwd,
		signal: options?.signal,
		timeout: options?.timeout,
		allowNonZero: true,
		allowAbort: true,
		stderr: "full",
	});

	const killed = Boolean(result.exitError?.aborted);
	return {
		stdout: result.stdout,
		stderr: result.stderr,
		// `ptree` leaves exitCode undefined when a process is aborted or cannot
		// produce a normal exit status. Never turn that into success: all current
		// callers use code === 0 as the success contract. A generic nonzero code
		// is intentional here; an AbortSignal does not imply SIGINT specifically.
		code: result.exitCode ?? 1,
		killed,
	};
}
