import { describe, expect, it } from "bun:test";
import {
	cronMatches,
	describeCron,
	getNextCronRun,
	parseCronExpression,
} from "../cron-parser";

describe("parseCronExpression", () => {
	it("returns 5 fields as raw strings", () => {
		const expr = parseCronExpression("0 2 * * 1");
		expect(expr.minute).toBe("0");
		expect(expr.hour).toBe("2");
		expect(expr.dayOfMonth).toBe("*");
		expect(expr.month).toBe("*");
		expect(expr.dayOfWeek).toBe("1");
	});

	it("preserves step and range syntax", () => {
		const expr = parseCronExpression("*/5 9-17 * * 1-5");
		expect(expr.minute).toBe("*/5");
		expect(expr.hour).toBe("9-17");
		expect(expr.dayOfWeek).toBe("1-5");
	});

	it("rejects wrong field count", () => {
		expect(() => parseCronExpression("* * *")).toThrow(/expected 5 fields/);
		expect(() => parseCronExpression("")).toThrow();
	});

	it("rejects out-of-range minute", () => {
		expect(() => parseCronExpression("60 * * * *")).toThrow();
	});

	it("rejects out-of-range hour", () => {
		expect(() => parseCronExpression("* 24 * * *")).toThrow();
	});

	it("rejects out-of-range day of month", () => {
		expect(() => parseCronExpression("* * 32 * *")).toThrow();
	});

	it("rejects out-of-range month", () => {
		expect(() => parseCronExpression("* * * 13 *")).toThrow();
	});

	it("rejects out-of-range day of week (8)", () => {
		expect(() => parseCronExpression("* * * * 8")).toThrow();
	});

	it("accepts day-of-week 7 as Sunday alias", () => {
		expect(() => parseCronExpression("* * * * 7")).not.toThrow();
	});

	it("rejects invalid range", () => {
		expect(() => parseCronExpression("5-2 * * * *")).toThrow();
	});

	it("rejects invalid step", () => {
		expect(() => parseCronExpression("*/0 * * * *")).toThrow();
	});
});

describe("cronMatches", () => {
	it("matches exact minute and hour", () => {
		const expr = parseCronExpression("0 0 * * *");
		expect(cronMatches(expr, new Date("2026-06-25T00:00:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-25T00:01:00Z"))).toBe(false);
	});

	it("matches every minute wildcard", () => {
		const expr = parseCronExpression("* * * * *");
		expect(cronMatches(expr, new Date("2026-06-25T10:30:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-25T15:45:00Z"))).toBe(true);
	});

	it("matches weekday-only cron", () => {
		const expr = parseCronExpression("0 9 * * 1-5");
		const fri = new Date("2026-06-26T09:00:00Z");
		expect(cronMatches(expr, fri)).toBe(true);
		const sat = new Date("2026-06-27T09:00:00Z");
		expect(cronMatches(expr, sat)).toBe(false);
	});

	it("matches step expression */15", () => {
		const expr = parseCronExpression("*/15 * * * *");
		expect(cronMatches(expr, new Date("2026-06-25T10:00:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-25T10:15:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-25T10:30:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-25T10:45:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-25T10:01:00Z"))).toBe(false);
	});

	it("matches specific day of month", () => {
		const expr = parseCronExpression("0 0 1 * *");
		expect(cronMatches(expr, new Date("2026-06-01T00:00:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-02T00:00:00Z"))).toBe(false);
	});

	it("matches specific month", () => {
		const expr = parseCronExpression("0 0 1 1 *");
		expect(cronMatches(expr, new Date("2026-01-01T00:00:00Z"))).toBe(true);
		expect(cronMatches(expr, new Date("2026-06-01T00:00:00Z"))).toBe(false);
	});
});

describe("getNextCronRun", () => {
	it("returns next minute for * * * * *", () => {
		const expr = parseCronExpression("* * * * *");
		const now = new Date("2026-06-25T10:30:00Z");
		const next = getNextCronRun(expr, now);
		expect(next).not.toBeNull();
		expect(next!.getTime()).toBeGreaterThan(now.getTime());
		expect(next!.getMinutes()).toBe(31);
	});

	it("returns next 2am for daily 2am cron", () => {
		const expr = parseCronExpression("0 2 * * *");
		const now = new Date("2026-06-25T10:30:00Z");
		const next = getNextCronRun(expr, now);
		expect(next).not.toBeNull();
		expect(next!.getHours()).toBe(2);
		expect(next!.getMinutes()).toBe(0);
	});

	it("returns next first-of-month", () => {
		const expr = parseCronExpression("0 0 1 * *");
		const now = new Date("2026-06-15T00:00:00Z");
		const next = getNextCronRun(expr, now);
		expect(next).not.toBeNull();
		expect(next!.getMonth()).toBe(6); // July
		expect(next!.getDate()).toBe(1);
	});
});

describe("describeCron", () => {
	it("returns a description string", () => {
		const desc = describeCron(parseCronExpression("* * * * *"));
		expect(typeof desc).toBe("string");
		expect(desc.length).toBeGreaterThan(0);
	});

	it("describes daily schedule", () => {
		const desc = describeCron(parseCronExpression("0 2 * * *"));
		expect(desc).toContain("2");
	});
});