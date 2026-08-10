import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveOpenAIRequestSetup } from "@oh-my-pi/pi-ai/providers/openai-shared";
import { AuthStorage } from "../../session/auth-storage";
import { kNoAuth, ModelRegistry } from "../model-registry";
import { ModelsConfigFile } from "../models-config";

function tempEnv(providersYaml: string): { modelsPath: string; dir: string } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b5-test-"));
	const modelsPath = path.join(dir, "models.yml");
	fs.writeFileSync(modelsPath, providersYaml);
	return { modelsPath, dir };
}

function registryFor(providersYaml: string): { registry: ModelRegistry; modelsPath: string; dir: string } {
	const { modelsPath, dir } = tempEnv(providersYaml);
	const authStorage = new AuthStorage(path.join(dir, "auth.db"));
	const registry = new ModelRegistry(authStorage, modelsPath);
	return { registry, modelsPath, dir };
}

describe("model-registry auth: none (B5)", () => {
	it("registers an explicit apiKey even with auth: none and authenticates requests", async () => {
		const { registry } = registryFor(
			[
				"providers:",
				"  keyed:",
				"    baseUrl: http://127.0.0.1:9999/v1",
				"    api: openai-completions",
				"    auth: none",
				"    apiKey: sk-test-123",
				"    models:",
				"      - id: m1",
				"        api: openai-completions",
			].join("\n"),
		);

		expect(registry.getError()).toBeUndefined();
		const model = registry.find("keyed", "m1");
		expect(model).toBeDefined();
		// The pinned key must NOT be skipped just because auth is "none".
		expect(await registry.getApiKey(model!)).toBe("sk-test-123");
		// Request setup carries the real bearer, not a keyless sentinel.
		const setup = resolveOpenAIRequestSetup(model!, {
			apiKey: (await registry.getApiKey(model!)) as string,
			messages: [],
		} as never);
		expect(setup.headers.Authorization).toBe("Bearer sk-test-123");
	});

	it("marks auth: none providers without a key as keyless and suppresses the bogus Authorization header", async () => {
		const { registry } = registryFor(
			[
				"providers:",
				"  keyless:",
				"    baseUrl: http://127.0.0.1:9999/v1",
				"    api: openai-completions",
				"    auth: none",
				"    models:",
				"      - id: m2",
				"        api: openai-completions",
			].join("\n"),
		);

		const model = registry.find("keyless", "m2");
		expect(model).toBeDefined();
		// Keyless providers resolve to the no-auth sentinel…
		expect(await registry.getApiKey(model!)).toBe(kNoAuth);
		// …but the request layer must not turn that into `Bearer N/A`.
		expect(model!.headers?.Authorization).toBe("");
		const setup = resolveOpenAIRequestSetup(model!, {
			apiKey: (await registry.getApiKey(model!)) as string,
			messages: [],
		} as never);
		expect(setup.headers.Authorization).toBe("");
	});

	it("accepts auth: bearer as a valid mode (used by real models.yml files)", async () => {
		const { registry } = registryFor(
			[
				"providers:",
				"  proxied:",
				"    baseUrl: http://127.0.0.1:20128/v1",
				"    api: openai-completions",
				"    auth: bearer",
				"    apiKey: sk-bearer-1",
				"    models:",
				"      - id: combo1",
				"        api: openai-completions",
			].join("\n"),
		);

		expect(registry.getError()).toBeUndefined();
		const model = registry.find("proxied", "combo1");
		expect(model).toBeDefined();
		expect(await registry.getApiKey(model!)).toBe("sk-bearer-1");
		const setup = resolveOpenAIRequestSetup(model!, {
			apiKey: (await registry.getApiKey(model!)) as string,
			messages: [],
		} as never);
		expect(setup.headers.Authorization).toBe("Bearer sk-bearer-1");
	});

	it("surfaces an invalid auth value as a load error instead of silently dropping all providers", () => {
		const { modelsPath } = tempEnv(
			[
				"providers:",
				"  bogus:",
				"    baseUrl: http://127.0.0.1:9999/v1",
				"    auth: not-a-mode",
				"    models:",
				"      - id: m3",
			].join("\n"),
		);

		const file = ModelsConfigFile.relocate(modelsPath);
		const load = file.tryLoad();
		expect(load.status).toBe("error");
	});
});
