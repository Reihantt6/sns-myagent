/**
 * Error resilience — SNS-MyAgent Phase 5.4
 *
 * Retry with exponential backoff, per-task timeout, circuit breaker,
 * and fallback model chain.
 */

import { EventEmitter } from "node:events";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Max attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in ms (default: 1000) */
  baseDelayMs: number;
  /** Max delay in ms (default: 30000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Jitter factor 0-1 (default: 0.2) */
  jitterFactor: number;
}

export interface CircuitBreakerOptions {
  /** Failures before opening (default: 3) */
  failureThreshold: number;
  /** Time in ms before half-open (default: 60000) */
  resetTimeoutMs: number;
  /** Successes in half-open to close (default: 2) */
  successThreshold: number;
}

export type CircuitState = "closed" | "open" | "half_open";

export interface TaskResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
  fromCache?: boolean;
}

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<TaskResult<T>> {
  const opts = { ...DEFAULT_RETRY, ...options };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < opts.maxAttempts) {
        // Exponential backoff with jitter
        const baseDelay = opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
        const jitter = baseDelay * opts.jitterFactor * (Math.random() * 2 - 1);
        const delay = Math.min(Math.max(0, baseDelay + jitter), opts.maxDelayMs);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: opts.maxAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

const DEFAULT_CIRCUIT: CircuitBreakerOptions = {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  successThreshold: 2,
};

export class CircuitBreaker extends EventEmitter {
  readonly #key: string;
  readonly #options: CircuitBreakerOptions;
  #state: CircuitState = "closed";
  #failureCount = 0;
  #successCount = 0;
  #lastFailureTime = 0;
  #nextAttemptTime = 0;

  constructor(key: string, options: Partial<CircuitBreakerOptions> = {}) {
    super();
    this.#key = key;
    this.#options = { ...DEFAULT_CIRCUIT, ...options };
  }

  get key(): string { return this.#key; }
  get state(): CircuitState { return this.#state; }
  get failureCount(): number { return this.#failureCount; }

  /**
   * Check if the circuit allows execution.
   */
  canExecute(): boolean {
    if (this.#state === "closed") return true;

    if (this.#state === "open") {
      if (Date.now() >= this.#nextAttemptTime) {
        this.#transitionTo("half_open");
        return true;
      }
      return false;
    }

    // half_open: allow one attempt
    return true;
  }

  /**
   * Record a successful execution.
   */
  recordSuccess(): void {
    if (this.#state === "half_open") {
      this.#successCount++;
      if (this.#successCount >= this.#options.successThreshold) {
        this.#transitionTo("closed");
      }
    } else {
      this.#failureCount = 0;
    }
  }

  /**
   * Record a failed execution.
   */
  recordFailure(): void {
    this.#lastFailureTime = Date.now();

    if (this.#state === "half_open") {
      this.#transitionTo("open");
      return;
    }

    this.#failureCount++;
    if (this.#failureCount >= this.#options.failureThreshold) {
      this.#transitionTo("open");
    }
  }

  /**
   * Execute a function through the circuit breaker.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker [${this.#key}] is OPEN. Retry after ${new Date(this.#nextAttemptTime).toISOString()}`
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  /**
   * Reset circuit breaker to closed state.
   */
  reset(): void {
    this.#state = "closed";
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#lastFailureTime = 0;
    this.#nextAttemptTime = 0;
  }

  /** Get stats for display */
  stats(): { key: string; state: CircuitState; failures: number; nextAttempt?: string } {
    return {
      key: this.#key,
      state: this.#state,
      failures: this.#failureCount,
      nextAttempt: this.#state === "open" ? new Date(this.#nextAttemptTime).toISOString() : undefined,
    };
  }

  #transitionTo(state: CircuitState): void {
    const prev = this.#state;
    this.#state = state;

    if (state === "open") {
      this.#nextAttemptTime = Date.now() + this.#options.resetTimeoutMs;
      this.#successCount = 0;
    }
    if (state === "closed") {
      this.#failureCount = 0;
      this.#successCount = 0;
      this.#nextAttemptTime = 0;
    }
    if (state === "half_open") {
      this.#successCount = 0;
    }

    this.emit("state_change", { key: this.#key, from: prev, to: state });
  }
}

// ─── Circuit Breaker Registry ────────────────────────────────────────────────

const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a provider/model key.
 */
export function getCircuitBreaker(key: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  if (!breakers.has(key)) {
    breakers.set(key, new CircuitBreaker(key, options));
  }
  return breakers.get(key)!;
}

/**
 * Get all circuit breaker stats.
 */
export function getAllCircuitBreakerStats(): Array<{ key: string; state: CircuitState; failures: number; nextAttempt?: string }> {
  return [...breakers.values()].map(b => b.stats());
}

// ─── Task Timeout ────────────────────────────────────────────────────────────

/**
 * Execute with timeout. Rejects with TimeoutError if exceeded.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label = "task",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`[${label}] timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn().then(
      (result) => { clearTimeout(timer); resolve(result); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── Fallback Chain ─────────────────────────────────────────────────────────

/**
 * Try primary fn first, then fallbacks in order.
 * Returns first successful result.
 */
export async function withFallback<T>(
  fns: Array<() => Promise<T>>,
  options: Partial<RetryOptions> = {},
): Promise<TaskResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  let totalAttempts = 0;

  for (const fn of fns) {
    const result = await withRetry(fn, { ...options, maxAttempts: 1 });
    totalAttempts += result.attempts;

    if (result.success) {
      return {
        success: true,
        result: result.result,
        attempts: totalAttempts,
        totalTimeMs: Date.now() - startTime,
      };
    }

    lastError = result.error;
  }

  return {
    success: false,
    error: lastError,
    attempts: totalAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
