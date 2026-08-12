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
