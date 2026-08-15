/**
 * Regression tests for {@link BaseKernel} pending-execution cleanup.
 *
 * When the kernel subprocess dies (or is shut down) while an execution is still
 * pending, `#abortPendingExecutions` must settle the request AND release its
 * per-execution resources (the timeout timer and the abort listener). The timer
 * is a *ref'd* `setTimeout` armed for the remainder of the cell's budget, so
 * skipping cleanup would keep the event loop alive for minutes after a crash.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { BaseKernel } from "../kernel-base";

/** Minimal concrete kernel so we can drive the base-class machinery directly. */
class TestKernel extends BaseKernel {
	constructor() {
		super("test-kernel", {
			languageName: "Test",
			traceIpc: false,
			exitPayload: "EXIT",
			interruptEscalationMs: 50,
			shutdownGraceMs: 50,
			buildPayload: (code: string, msgId: string) => JSON.stringify({ type: "exec", code, id: msgId }),
		});
	}
}

/** A hand-rolled subprocess surface with just what `BaseKernel.setProcess` uses. */
function makeFakeProcess(): {
	proc: Parameters<BaseKernel["setProcess"]>[0];
	resolveExit: (code: number) => void;
	stdinWrites: string[];
} {
	const stdinWrites: string[] = [];
	const { promise: exited, resolve: resolveExit } = Promise.withResolvers<number>();
	const emptyStream = () => new ReadableStream<Uint8Array>({ start() {} });
	const proc = {
		stdin: { write: (s: string) => void stdinWrites.push(s), flush: () => 0, end: () => {} },
		stdout: emptyStream(),
		stderr: emptyStream(),
		exited,
		kill: (_signal: string) => {},
	} as unknown as Parameters<BaseKernel["setProcess"]>[0];
	return { proc, resolveExit, stdinWrites };
}

describe("BaseKernel pending-execution cleanup", () => {
	const kernels: TestKernel[] = [];
	afterEach(async () => {
		for (const kernel of kernels.splice(0)) {
			await kernel.shutdown().catch(() => {});
		}
	});

	it("settles a pending execution and releases its abort listener when the kernel exits", async () => {
		const kernel = new TestKernel();
		kernels.push(kernel);
		const { proc, resolveExit } = makeFakeProcess();
		kernel.setProcess(proc);

		const controller = new AbortController();
		const signal = controller.signal;
		const originalRemove = signal.removeEventListener.bind(signal);
		let removeCalls = 0;
		(signal as AbortSignal & { removeEventListener: typeof signal.removeEventListener }).removeEventListener = (
			type,
			listener,
			options,
		) => {
			removeCalls++;
			return originalRemove(type, listener, options);
		};

		const chunks: string[] = [];
		const execution = kernel.execute("print(1)", {
			id: "req-1",
			timeoutMs: 60_000,
			signal,
			onChunk: text => {
				chunks.push(text);
			},
		});

		// Let the request write its payload and register its timers/listeners.
		await Bun.sleep(5);
		expect(chunks.length).toBe(0);

		// Simulate the kernel subprocess dying (e.g. segfault) mid-request.
		resolveExit(1);
		const result = await execution;

		expect(result.cancelled).toBe(true);
		expect(result.kernelKilled).toBe(true);
		expect(chunks).toEqual(["[kernel] Test kernel exited with code 1\n"]);

		// The abort listener must have been detached by the cleanup path — without
		// it the ref'd 60s timeout timer and stale listener would linger.
		expect(removeCalls).toBeGreaterThan(0);
	});

	it("settles every in-flight execution when shutdown() aborts them", async () => {
		const kernel = new TestKernel();
		kernels.push(kernel);
		const { proc } = makeFakeProcess();
		kernel.setProcess(proc);

		const chunks: string[] = [];
		const execution = kernel.execute("print(2)", {
			id: "req-2",
			timeoutMs: 60_000,
			onChunk: text => {
				chunks.push(text);
			},
		});
		await Bun.sleep(5);

		await kernel.shutdown();
		const result = await execution;

		expect(result.cancelled).toBe(true);
		expect(result.kernelKilled).toBe(true);
		expect(chunks).toEqual(["[kernel] Test kernel shutdown\n"]);
	});
});
