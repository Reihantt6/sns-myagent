/**
 * BYOK (Bring Your Own Key) setup tab.
 *
 * Quick-connect tab in the providers scene. User enters Base URL + API Key +
 * selects API type → auto-detects models → saves to models.yml.
 */
import { type Component, type Focusable, Input, type SgrMouseEvent } from "@oh-my-pi/pi-tui";
import { YAML } from "bun";
import { getAgentDir, logger } from "@oh-my-pi/pi-utils";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { theme } from "../../theme/theme";
import type { SetupSceneHost, SetupTab } from "./types";

// ─── API type options ───────────────────────────────────────────────
const API_TYPE_OPTIONS = [
	{ value: "openai-completions", label: "OpenAI Compatible" },
	{ value: "openai-responses", label: "OpenAI Responses" },
	{ value: "anthropic-messages", label: "Anthropic" },
	{ value: "google-generative-ai", label: "Google Gemini" },
	{ value: "azure-openai-responses", label: "Azure OpenAI" },
] as const;

type ApiType = (typeof API_TYPE_OPTIONS)[number]["value"];

// ─── Focusable input wrapper ────────────────────────────────────────
class FieldInput implements Component, Focusable {
	#input: Input;
	#label: string;
	#masked: boolean;

	constructor(label: string, masked = false) {
		this.#input = new Input();
		this.#input.prompt = "";
		this.#label = label;
		this.#masked = masked;
	}

	get focused(): boolean {
		return this.#input.focused;
	}
	set focused(value: boolean) {
		this.#input.focused = value;
	}
	setUseTerminalCursor(v: boolean): void {
		this.#input.setUseTerminalCursor(v);
	}
	getValue(): string {
		return this.#input.getValue();
	}
	setValue(v: string): void {
		this.#input.setValue(v);
	}

	handleInput(data: string): void {
		this.#input.handleInput(data);
	}
	invalidate(): void {
		this.#input.invalidate();
	}

	render(width: number): readonly string[] {
		const val = this.#input.getValue();
		const display = this.#masked ? "*".repeat(Math.min(val.length, 40)) : val;
		const prefix = theme.fg("accent", "● ");
		const label = theme.bold(this.#label);
		const sep = theme.fg("dim", ": ");
		const field = this.#input.focused
			? theme.fg("muted", display + "█")
			: theme.fg("dim", display || "(empty)");
		return [prefix + label + sep + field];
	}
}

// ─── State machine ─────────────────────────────────────────────────
type ByokState = "input" | "detecting" | "success" | "error";

// ─── BYOK Tab ───────────────────────────────────────────────────────
export class ByokSetupTab implements SetupTab {
	readonly id = "byok";
	readonly label = "BYOK";
	get modal(): boolean { return this.#detecting; }

	#baseUrl: FieldInput;
	#apiKey: FieldInput;
	#apiTypeIndex = 0;
	#fields: FieldInput[];
	#focusIndex = 0; // 0=baseUrl, 1=apiKey, 2=apiType
	#state: ByokState = "input";
	#statusLines: string[] = [];
	#modelCount = 0;
	#disposed = false;
	#detecting = false;

	constructor(private readonly host: SetupSceneHost) {
		this.#baseUrl = new FieldInput("Base URL");
		this.#apiKey = new FieldInput("API Key", true);
		this.#fields = [this.#baseUrl, this.#apiKey];
		this.#baseUrl.setValue("https://api.openai.com/v1");
		this.#focusInput();
	}

	onActivate(): void {
		this.#focusInput();
		this.host.requestRender();
	}

	handleInput(data: string): void {
		if (this.#state === "detecting") return; // block input during detection

		if (data === "\x1b[A" || data === "\x1b[B") {
			// Up/Down in api type selector
			if (this.#focusIndex === 2) {
				const dir = data === "\x1b[A" ? -1 : 1;
				this.#apiTypeIndex = (this.#apiTypeIndex + dir + API_TYPE_OPTIONS.length) % API_TYPE_OPTIONS.length;
				this.host.requestRender();
				return;
			}
		}

		if (data === "\t" || (data === "\x1b[B" && this.#focusIndex < 2)) {
			this.#focusIndex = Math.min(2, this.#focusIndex + 1);
			this.#focusInput();
			this.host.requestRender();
			return;
		}

		if (data === "\x1b[Z") { // Shift+Tab
			this.#focusIndex = Math.max(0, this.#focusIndex - 1);
			this.#focusInput();
			this.host.requestRender();
			return;
		}

		if (data === "\r" || data === "\n") {
			if (this.#focusIndex < 2) {
				// Move to next field on Enter
				this.#focusIndex = Math.min(2, this.#focusIndex + 1);
				this.#focusInput();
			} else {
				// Submit on Enter from api type
				void this.#submit();
			}
			this.host.requestRender();
			return;
		}

		// Forward to focused input field
		if (this.#focusIndex < 2) {
			this.#fields[this.#focusIndex].handleInput(data);
		}
		this.host.requestRender();
	}

	routeMouse(_event: SgrMouseEvent, _line: number, _col: number): void {
		// No mouse routing needed for simple fields
	}

	invalidate(): void {
		for (const f of this.#fields) f.invalidate();
	}

	dispose(): void {
		this.#disposed = true;
	}

	render(width: number): readonly string[] {
		const lines: string[] = [];
		lines.push(theme.fg("muted", "Enter your provider details. Tab between fields, Enter to connect."));
		lines.push(theme.fg("dim", "⚠ API Key stored locally in ~/.sns-myagent/models.yml"));
		lines.push("");

		// Base URL field
		lines.push(...this.#baseUrl.render(width));

		// API Key field
		lines.push(...this.#apiKey.render(width));

		// API Type selector
		const selected = API_TYPE_OPTIONS[this.#apiTypeIndex];
		const prefix = theme.fg("accent", "● ");
		const label = theme.bold("API Type");
		const sep = theme.fg("dim", ": ");
		const value = this.#focusIndex === 2
			? theme.fg("muted", `◀ ${selected.label} ▶`)
			: theme.fg("dim", selected.label);
		const hint = this.#focusIndex === 2
			? theme.fg("dim", "  ↑↓ to change")
			: "";
		lines.push(prefix + label + sep + value + hint);

		// Status lines
		if (this.#statusLines.length > 0) {
			lines.push("");
			lines.push(...this.#statusLines);
		}

		return lines;
	}

	#focusInput(): void {
		for (const f of this.#fields) f.focused = false;
		if (this.#focusIndex < 2) {
			this.#fields[this.#focusIndex].focused = true;
			this.host.setFocus(this.#fields[this.#focusIndex]);
		} else {
			this.host.setFocus(null);
		}
	}

	async #submit(): Promise<void> {
		const baseUrl = this.#baseUrl.getValue().trim().replace(/\/+$/, "");
		const apiKey = this.#apiKey.getValue().trim();
		const apiType = API_TYPE_OPTIONS[this.#apiTypeIndex].value as ApiType;

		// Validate
		if (!baseUrl) {
			this.#statusLines = [theme.fg("error", `${theme.status.error} Base URL is required`)];
			this.host.requestRender();
			return;
		}

		this.#state = "detecting";
		this.#detecting = true;
		this.#statusLines = [theme.fg("dim", "Detecting models…")];
		this.host.requestRender();

		try {
			// Auto-detect models for OpenAI-compatible providers
			const models = apiType === "openai-completions" || apiType === "openai-responses"
				? await this.#detectModels(baseUrl, apiKey)
				: [];

			this.#modelCount = models.length;

			// Write models.yml
			await this.#saveProvider(baseUrl, apiKey, apiType, models);

			this.#state = "success";
			this.#detecting = false;
			const modelInfo = models.length > 0
				? `${models.length} model${models.length !== 1 ? "s" : ""} detected`
				: "connected (manual model config needed)";
			this.#statusLines = [
				theme.fg("success", `${theme.status.success} ${modelInfo}`),
				theme.fg("dim", `Provider saved to ~/.sns-myagent/models.yml`),
			];
		} catch (err) {
			this.#state = "error";
			this.#detecting = false;
			const msg = err instanceof Error ? err.message : String(err);
			this.#statusLines = [
				theme.fg("error", `${theme.status.error} ${msg}`),
				theme.fg("dim", "Check your Base URL and API Key, then try again."),
			];
		}

		this.host.requestRender();
	}

	async #detectModels(baseUrl: string, apiKey: string): Promise<string[]> {
		const url = `${baseUrl}/models`;
		const headers: Record<string, string> = {};
		if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

		const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
		if (!response.ok) {
			if (response.status === 401 || response.status === 403) {
				throw new Error("API Key rejected — check your credentials");
			}
			throw new Error(`Provider returned HTTP ${response.status}`);
		}

		const data = await response.json() as { data?: { id: string }[] };
		if (!data.data || !Array.isArray(data.data)) {
			return [];
		}
		return data.data.map((m) => m.id).filter(Boolean).sort();
	}

	async #saveProvider(baseUrl: string, apiKey: string, apiType: ApiType, models: string[]): Promise<void> {
		const agentDir = path.join(os.homedir(), ".sns-myagent");
		const configPath = path.join(agentDir, "models.yml");

		// Read existing config
		let existing: Record<string, unknown> = {};
		if (fs.existsSync(configPath)) {
			try {
				const content = fs.readFileSync(configPath, "utf-8");
				existing = YAML.parse(content) as Record<string, unknown> ?? {};
			} catch {
				existing = {};
			}
		}

		const providers = (existing.providers ?? {}) as Record<string, unknown>;

		// Generate provider name from base URL
		const providerName = this.#deriveProviderName(baseUrl);

		const providerConfig: Record<string, unknown> = {
			baseUrl,
			api: apiType,
			auth: "apiKey",
		};
		if (apiKey) providerConfig.apiKey = apiKey;

		if (models.length > 0) {
			providerConfig.models = models.map((id) => ({
				id,
				api: apiType,
				contextWindow: 128000,
				supportsTools: true,
			}));
		}

		providers[providerName] = providerConfig;
		existing.providers = providers;

		// Ensure directory exists
		if (!fs.existsSync(agentDir)) {
			fs.mkdirSync(agentDir, { recursive: true });
		}

		fs.writeFileSync(configPath, YAML.stringify(existing), "utf-8");
		logger.info(`BYOK: provider "${providerName}" saved to ${configPath}`);
	}

	#deriveProviderName(baseUrl: string): string {
		try {
			const url = new URL(baseUrl);
			const host = url.hostname.replace(/^api\./, "").replace(/\./g, "-");
			return host || "custom-provider";
		} catch {
			return "custom-provider";
		}
	}
}
