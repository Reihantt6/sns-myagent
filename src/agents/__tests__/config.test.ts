/**
 * agents.yaml config tests — SNS-MyAgent Phase 5.2
 *
 * Tests YAML parsing + config validation without touching real fs paths
 * (uses tmp dirs and cleans up after).
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseYamlSimple, DEFAULT_CONFIG, AgentsConfigManager } from "../config.js";

describe("parseYamlSimple", () => {
	it("parses simple key:value pairs", () => {
		const out = parseYamlSimple("model: gpt-4o\nprovider: openai");
		expect(out.model).toBe("gpt-4o");
		expect(out.provider).toBe("openai");
	});

	it("returns empty object on empty input", () => {
		expect(parseYamlSimple("")).toEqual({});
	});

	it("does not throw on indented map", () => {
		expect(() =>
			parseYamlSimple(`agents:
  coder:
    model: gpt-4o
    tools: bash
`),
		).not.toThrow();
	});
});

describe("AgentsConfigManager", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "agents-config-"));
		mkdirSync(join(tmpDir, ".sns-myagent"), { recursive: true });
	});
	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("loads bundled defaults when no custom config", () => {
		const mgr = new AgentsConfigManager();
		const cfg = mgr.load();
		expect(cfg.agents).toBeDefined();
	});

	it("loads project config from disk", () => {
		const yaml = `agents:
  reviewer:
    model: gpt-4o-mini
    tools:
      - read
`;
		writeFileSync(join(tmpDir, ".sns-myagent", "agents.yaml"), yaml);
		const prevCwd = process.cwd();
		process.chdir(tmpDir);
		try {
			const mgr = new AgentsConfigManager();
			mgr.load();
			expect(mgr.config.agents).toBeDefined();
		} finally {
			process.chdir(prevCwd);
		}
	});
});

describe("DEFAULT_CONFIG", () => {
	it("has ensembles + defaults", () => {
		expect(DEFAULT_CONFIG.ensembles).toBeDefined();
		expect(DEFAULT_CONFIG.default_agent).toBe("task");
		expect(typeof DEFAULT_CONFIG.max_concurrency).toBe("number");
	});
});