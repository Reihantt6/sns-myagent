import { beforeAll, describe, expect, it } from "bun:test";
import type { Component } from "@oh-my-pi/pi-tui";
import { Settings } from "../../../config/settings";
import { getThemeByName, setThemeInstance, type Theme } from "../../theme/theme";
import { ProvidersSceneController } from "./providers";
import type { SetupSceneHost, SetupTab } from "./types";

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

/** Fake tab that records which keys it received; no real UI deps. */
function makeFakeTab(id: string, owned: boolean, isModal = false): SetupTab & { received: string[] } {
	const received: string[] = [];
	return {
		id,
		label: id,
		modal: isModal,
		tabKeyOwned: () => owned,
		render: () => [`[${id}]`],
		handleInput: (data: string) => {
			received.push(data);
		},
		invalidate: () => {},
		dispose: () => {},
		received,
	};
}

describe("providers scene routes Tab/Shift+Tab by tab ownership", () => {
	let uiTheme: Theme;

	beforeAll(async () => {
		await Settings.init({ inMemory: true });
		const loaded = await getThemeByName("dark");
		if (!loaded) throw new Error("theme unavailable");
		uiTheme = loaded;
		setThemeInstance(uiTheme);
	});

	it("forwards Tab to a tab that owns the Tab key (BYOK field navigation)", () => {
		const { host } = makeHost();
		const byok = makeFakeTab("byok", true);
		const other = makeFakeTab("other", false);
		const controller = new ProvidersSceneController(host, [byok, other]);

		controller.handleInput("\t");
		expect(byok.received).toContain("\t");
		expect(other.received).not.toContain("\t");

		controller.handleInput("\x1b[Z");
		expect(byok.received).toContain("\x1b[Z");
	});

	it("leaves Tab to the tab bar when the active tab does not own it", () => {
		const { host } = makeHost();
		const tabA = makeFakeTab("a", false);
		const tabB = makeFakeTab("b", false);
		const controller = new ProvidersSceneController(host, [tabA, tabB]);

		controller.handleInput("\t"); // not owned -> tab bar next()
		const lines = stripAnsi(controller.render(100));
		expect(lines.join("\n")).toContain("> b".replace(">", ""));
		expect(tabA.received).not.toContain("\t");
		// The active tab is now b; Tab still not owned -> goes to tab bar again.
		controller.handleInput("\t");
		expect(tabB.received).not.toContain("\t");
	});

	it("modal tab receives everything (Tab included) without switching panels", () => {
		const { host } = makeHost();
		const modal = makeFakeTab("modal", false, true);
		const other = makeFakeTab("other", false);
		const controller = new ProvidersSceneController(host, [modal, other]);

		controller.handleInput("\t");
		expect(modal.received).toContain("\t");
		expect(other.received).not.toContain("\t");
	});
});