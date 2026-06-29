/**
 * Resilience module smoke tests — SNS-MyAgent Phase 5.4
 *
 * Pure logic tests for retry, timeout, circuit breaker, fallback.
 * No DB, no LLM, no async intervals.
 */

import { describe, it, expect } from "bun:test";
import {
	withRetry,
	withTimeout,
	withFallback,
	CircuitBreaker,
	TimeoutError,
	CircuitBreakerOpenError,
} from "../resilience.js";

describe("withRetry", () => {
	it("returns result on first success", async () => {
		let calls = 0;
		const out = await withRetry(
			async () => {
				calls++;
				return 42;
			},
			{ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1, jitterFactor: 0 },
		);
		expect(out.success).toBe(true);
		expect(out.result).toBe(42);
		expect(calls).toBe(1);
	});

	it("retries until success", async () => {
		let calls = 0;
		const out = await withRetry(
			async () => {
				calls++;
				if (calls < 3) throw new Error("transient");
				return "ok";
			},
			{ maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1, jitterFactor: 0 },
		);
		expect(out.success).toBe(true);
		expect(out.result).toBe("ok");
		expect(calls).toBe(3);
	});

	it("fails after maxAttempts", async () => {
		let calls = 0;
		const out = await withRetry(
			async () => {
				calls++;
				throw new Error("permanent");
			},
			{ maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1, jitterFactor: 0 },
		);
		expect(out.success).toBe(false);
		expect(out.error?.message).toBe("permanent");
		expect(calls).toBe(2);
	});
});

describe("withTimeout", () => {
	it("resolves when fn finishes fast", async () => {
		const out = await withTimeout(async () => "fast", 100);
		expect(out).toBe("fast");
	});

	it("rejects with TimeoutError on slow fn", async () => {
		await expect(
			withTimeout(async () => {
				await new Promise((r) => setTimeout(r, 200));
				return "slow";
			}, 20),
		).rejects.toBeInstanceOf(TimeoutError);
	});
});

describe("withFallback", () => {
	it("returns primary result when it succeeds", async () => {
		const out = await withFallback([
			async () => "primary",
			async () => "fallback",
		]);
		expect(out.success).toBe(true);
		expect(out.result).toBe("primary");
	});

	it("falls back when primary throws", async () => {
		const out = await withFallback([
			async () => {
				throw new Error("primary down");
			},
			async () => "fallback",
		]);
		expect(out.success).toBe(true);
		expect(out.result).toBe("fallback");
	});
});

describe("CircuitBreaker", () => {
	it("opens after threshold failures", async () => {
		const cb = new CircuitBreaker("test1", { failureThreshold: 2, resetTimeoutMs: 60_000 });
		const failing = async () => {
			throw new Error("boom");
		};
		await expect(cb.execute(failing)).rejects.toThrow();
		await expect(cb.execute(failing)).rejects.toThrow();
		await expect(cb.execute(failing)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
		expect(cb.state).toBe("open");
	});

	it("closes after successful execution in closed state", async () => {
		const cb = new CircuitBreaker("test2", { failureThreshold: 5 });
		const out = await cb.execute(async () => "ok");
		expect(out).toBe("ok");
		expect(cb.state).toBe("closed");
	});
});