import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import type { Component, SgrMouseEvent } from "@oh-my-pi/pi-tui";
import { Settings } from "../../../config/settings";
import { getThemeByName, setThemeInstance, type Theme } from "../../theme/theme";
import { ByokSetupTab } from "./byok-setup";
import type { SetupSceneHost } from "./types";

function stripAnsi(lines: readonly string[]): string[] {
	return lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ""));
}

function makeHost() {
	const focusTargets: (Component | null)[] = [];
	const host = {
		ctx: {} as SetupSceneHost["ctx"],
		requestRender: () => {},
		finish: () => {},
		setFocus: (component: Component | null) => {
			focusTargets.push(component);
		},
		restoreFocus: () => {},
	} satisfies SetupSceneHost;
	return { host, focusTargets };
}

function makeMouseEvent(): SgrMouseEvent {
	return {
		button: 0,
		col: 0,
		row: 0,
		release: false,
		wheel: null,
		motion: false,
		leftClick: true,
	};
}

async function flushAsyncWork(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe("ByokSetupTab keyboard navigation", () => {
	let uiTheme: Theme;
	const originalFetch = globalThis.fetch;

	beforeAll(async () => {
		await Settings.init({ inMemory: true });
		const loaded = await getThemeByName("dark");
		if (!loaded) throw new Error("theme unavailable");
		uiTheme = loaded;
		setThemeInstance(uiTheme);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("moves focus from Base URL to API Key, then API Type with Tab", () => {
		const { host, focusTargets } = makeHost();
		const tab = new ByokSetupTab(host);
		expect(focusTargets.at(-1)).toBe(tab);
		const focusedTab = () => focusTargets.at(-1) as Component;

		let lines = stripAnsi(tab.render(120));
		expect(lines.find(line => line.includes("● Base URL"))).toContain("█");
		expect(lines.find(line => line.includes("● API Key"))).toContain("(empty)");

		focusedTab().handleInput?.("\t");
		lines = stripAnsi(tab.render(120));
		expect(lines.find(line => line.includes("● Base URL"))).not.toContain("█");
		expect(lines.find(line => line.includes("● API Key"))).toContain("█");

		focusedTab().handleInput?.("\t");
		lines = stripAnsi(tab.render(120));
		expect(lines.find(line => line.includes("● API Key"))).not.toContain("█");
		expect(lines.find(line => line.includes("● API Type"))).toContain("◀ OpenAI Compatible ▶");
	});

	it("submits when Enter is pressed from Base URL, API Key, or API Type", async () => {
		const baseUrlHost = makeHost();
		const baseUrlTab = new ByokSetupTab(baseUrlHost.host);
		(baseUrlHost.focusTargets.at(-1) as Component).handleInput?.("\r");
		expect(stripAnsi(baseUrlTab.render(120)).join("\n")).toContain("API Key is required");

		let requests = 0;
		globalThis.fetch = async () => {
			requests++;
			return new Response(null, { status: 401 });
		};

		const apiKeyHost = makeHost();
		const apiKeyTab = new ByokSetupTab(apiKeyHost.host);
		(apiKeyHost.focusTargets.at(-1) as Component).handleInput?.("\t");
		(apiKeyHost.focusTargets.at(-1) as Component).handleInput?.("test-key");
		(apiKeyHost.focusTargets.at(-1) as Component).handleInput?.("\r");
		await flushAsyncWork();
		expect(requests).toBe(1);

		const apiTypeHost = makeHost();
		const apiTypeTab = new ByokSetupTab(apiTypeHost.host);
		(apiTypeHost.focusTargets.at(-1) as Component).handleInput?.("\t");
		(apiTypeHost.focusTargets.at(-1) as Component).handleInput?.("test-key");
		(apiTypeHost.focusTargets.at(-1) as Component).handleInput?.("\t");
		(apiTypeHost.focusTargets.at(-1) as Component).handleInput?.("\r");
		await flushAsyncWork();
		expect(requests).toBe(2);
	});

	it("focuses the clicked API Key row", () => {
		const { host, focusTargets } = makeHost();
		const tab = new ByokSetupTab(host);
		tab.routeMouse(makeMouseEvent(), 4, 0);
		expect(focusTargets.at(-1)).toBe(tab);

		const apiKeyLine = stripAnsi(tab.render(120)).find(line => line.includes("● API Key"));
		expect(apiKeyLine).toContain("█");
	});
});

describe("ByokSetupTab submission validation", () => {
	let uiTheme: Theme;
	const originalFetch = globalThis.fetch;

	beforeAll(async () => {
		await Settings.init({ inMemory: true });
		const loaded = await getThemeByName("dark");
		if (!loaded) throw new Error("theme unavailable");
		uiTheme = loaded;
		setThemeInstance(uiTheme);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	async function submitWith(baseUrl: string, apiKey: string): Promise<string> {
		const { host, focusTargets } = makeHost();
		const tab = new ByokSetupTab(host);
		const input = () => focusTargets.at(-1) as Component;
		// Base URL field is focused first. The constructor pre-fills a default
		// value, so clear it with backspaces before typing our test value.
		for (let i = 0; i < 40; i++) input().handleInput?.("\x7f");
		input().handleInput?.(baseUrl);
		input().handleInput?.("\t");
		input().handleInput?.(apiKey);
		input().handleInput?.("\r");
		// The submit path awaits fetch → json → save; let all microtasks settle.
		for (let i = 0; i < 10; i++) await flushAsyncWork();
		return stripAnsi(tab.render(120)).join("\n");
	}

	it("rejects a scheme-less base URL without hitting the network", async () => {
		let requests = 0;
		globalThis.fetch = async () => {
			requests++;
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		};
		const output = await submitWith("api.example.com/v1", "sk-test");
		expect(requests).toBe(0);
		expect(output).toContain("must include a scheme");
	});

	it("rejects a non-http(s) scheme", async () => {
		const output = await submitWith("ftp://api.example.com/v1", "sk-test");
		expect(output).toContain("must use http:// or https://");
	});

	it("rejects a host-less URL", async () => {
		const output = await submitWith("https://", "sk-test");
		expect(output).toContain("must include a scheme");
	});

	it("rejects an empty API key for a remote provider", async () => {
		const output = await submitWith("https://api.example.com/v1", "");
		expect(output).toContain("API Key is required");
	});

	it("shows a friendly error when the /models endpoint returns non-JSON", async () => {
		globalThis.fetch = async () => new Response("<html>gateway error</html>", { status: 200 });
		const output = await submitWith("https://api.example.com/v1", "sk-test");
		expect(output).toContain("non-JSON response");
	});

	it("tolerates null/object entries in the /models response", async () => {
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ data: [null, { id: "gpt-4o" }, { foo: 1 }, { id: "" }] }), { status: 200 });
		const output = await submitWith("https://api.example.com/v1", "sk-test");
		expect(output).toContain("1 model detected");
	});

	it("surfaces a 401 from the /models endpoint", async () => {
		globalThis.fetch = async () => new Response(null, { status: 401 });
		const output = await submitWith("https://api.example.com/v1", "sk-wrong");
		expect(output).toContain("API Key rejected");
	});
});
