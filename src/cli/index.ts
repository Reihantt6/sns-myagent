/**
 * SNS-MyAgent Phase 2A CLI — minimal router.
 *
 * Commands:
 *   snsagent version               print package version
 *   snsagent init                  create .sns-myagent/config.json with defaults
 *   snsagent chat [--stub]         start interactive chat (stub for Phase 2B)
 *   snsagent config [show|get k|set k v]   show / read / write config values
 *   snsagent help                  this help
 *
 * No external parser — manual argv handling, zero new deps.
 */

import { loadConfig, saveConfig, configPath, ensureConfig } from "../config/loader.js";
import type { Config } from "../config/schema.js";
import { defaultConfigFn } from "../config/loader.js";
import { getAgentDir } from "@oh-my-pi/pi-utils";
import { startTelegramAdapter, stopTelegramAdapter } from "../adapters/telegram/index.js";
import { createForwardToAgent, resetChatSession, getBridgeStats } from "../adapters/telegram/bridge.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";

// ---------- package version (single source of truth) ----------

// Inline version — kept in sync with package.json. Read from package.json at
// runtime so the bin script does not need a second copy.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Read package version with this precedence:
 *   1. process.env.PKG_VERSION (set by `bun build --define` at compile time)
 *   2. ../../../package.json (works for dev / unbundled runs)
 *   3. "0.0.0" fallback
 */
function readPackageVersion(): string {
	const fromDefine = process.env.PKG_VERSION;
	if (typeof fromDefine === "string" && fromDefine.length > 0) {
		// Bun's --define injects the literal value as written. When the value
		// is a JSON string (e.g. --define process.env.PKG_VERSION='"0.3.0"'),
		// the surrounding quotes leak into process.env. Strip them.
		const stripped = fromDefine.replace(/^["']|["']$/g, "");
		if (stripped.length > 0) return stripped;
	}
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		// src/cli/index.ts → ../..  → package.json
		const pkgPath = resolve(here, "..", "..", "package.json");
		const raw = readFileSync(pkgPath, "utf8");
		const pkg = JSON.parse(raw) as { version?: string };
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

export const PKG_VERSION = readPackageVersion();

// ---------- command handlers ----------

function cmdVersion(): number {
	process.stdout.write(`snsagent ${PKG_VERSION}\n`);
	return 0;
}

/** Derive a provider name from base URL for models.yml key. */
function deriveProviderName(baseUrl: string): string {
	try {
		const url = new URL(baseUrl);
		return url.hostname.replace(/^api\./, "").replace(/\./g, "-") || "custom-provider";
	} catch {
		return "custom-provider";
	}
}

async function cmdInit(): Promise<number> {
	const path = configPath();
	try {
		const existing = loadConfig();
		if (existing) {
			process.stdout.write(`✓ config already exists at ${path}\n`);
			// Still allow BYOK provider re-configuration
			process.stdout.write(`  ${chalk.dim("Re-run provider setup? [y/N] ")}`);
			const rl = createInterface({ input: stdin, output: stdout });
			const reconfigure = await rl.question("");
			if (reconfigure.trim().toLowerCase() !== "y") {
				rl.close();
				return 0;
			}
			await byokProviderSetup(rl);
			rl.close();
			return 0;
		}

		// Interactive memory backend selection
		const rl = createInterface({ input: stdin, output: stdout });

		process.stdout.write("\n");
		process.stdout.write(`  ${chalk.cyan("●")} ${chalk.bold("Memory Backend Selection")}\n`);
		process.stdout.write(`  ${chalk.dim("Select memory backend (default: mnemopi):")}\n`);
		process.stdout.write(`    ${chalk.cyan("1")} mnemopi (default) — SQLite + vector + graph, offline, no config\n`);
		process.stdout.write(`    ${chalk.cyan("2")} local — rollout summary only\n`);
		process.stdout.write(`    ${chalk.cyan("3")} mnemosyne — advanced local (Python daemon)\n`);
		process.stdout.write(`    ${chalk.cyan("4")} mem0 — cloud API (needs MEM0_API_KEY)\n`);
		process.stdout.write(`    ${chalk.cyan("5")} lcm — local server (needs LCM_HOST)\n`);
		process.stdout.write(`    ${chalk.cyan("6")} hindsight — cloud (needs HINDSIGHT_API_KEY)\n`);
		process.stdout.write(`    ${chalk.cyan("7")} off — disabled\n`);
		process.stdout.write(`  [1] `);

		const answer = await rl.question("");

		let backend: "mnemopi" | "hindsight" | "mnemosyne" | "mem0" | "lcm" | "local" | "off" = "mnemopi";
		switch (answer.trim()) {
			case "1":
			case "":
				backend = "mnemopi";
				break;
			case "2":
				backend = "local";
				break;
			case "3":
				backend = "mnemosyne";
				break;
			case "4":
				backend = "mem0";
				break;
			case "5":
				backend = "lcm";
				break;
			case "6":
				backend = "hindsight";
				break;
			case "7":
				backend = "off";
				break;
			default:
				process.stdout.write(`  ${chalk.dim("unknown option, using default (mnemopi)")}\n`);
				backend = "mnemopi";
		}

		// Mnemosyne needs Python daemon
		if (backend === "mnemosyne") {
			process.stdout.write(`\n  ${chalk.cyan("●")} mnemosyne requires Python daemon.\n`);
			process.stdout.write(`  ${chalk.dim("Install now? (pip install mnemosyne) [Y/n] ")}`);
			const yn = await rl.question("");
			if (!yn || yn.toLowerCase() === "y") {
				process.stdout.write(`  ${chalk.dim("installing mnemosyne... (placeholder)")}\n`);
				// TODO: actual pip install
			}
		}

		// ── BYOK Provider Setup ─────────────────────────────────────
		process.stdout.write("\n");
		process.stdout.write(`  ${chalk.cyan("●")} ${chalk.bold("AI Provider Setup")}\n`);
		process.stdout.write(`  ${chalk.dim("Connect your LLM provider (skip to set via env vars later):")}\n`);

		// Base URL
		process.stdout.write(`  ${chalk.cyan("●")} Base URL [https://api.openai.com/v1]: `);
		const baseUrlRaw = await rl.question("");
		const baseUrl = (baseUrlRaw.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");

		// API Key
		process.stdout.write(`  ${chalk.cyan("●")} API Key: `);
		const apiKey = await rl.question("");

		// API type
		process.stdout.write(`  ${chalk.cyan("●")} API Type:\n`);
		process.stdout.write(`    ${chalk.cyan("1")} openai-completions (default — OpenAI, OpenRouter, Ollama, vLLM)\n`);
		process.stdout.write(`    ${chalk.cyan("2")} anthropic-messages\n`);
		process.stdout.write(`    ${chalk.cyan("3")} google-generative-ai\n`);
		process.stdout.write(`    ${chalk.cyan("4")} azure-openai-responses\n`);
		process.stdout.write(`  [1] `);
		const apiTypeAnswer = await rl.question("");

		const apiTypeMap: Record<string, string> = {
			"1": "openai-completions",
			"2": "anthropic-messages",
			"3": "google-generative-ai",
			"4": "azure-openai-responses",
		};
		const apiType = apiTypeMap[apiTypeAnswer.trim()] || "openai-completions";

		// Save provider to models.yml
		if (apiKey.trim()) {
			try {
				const { YAML } = await import("bun");
				const agentDir = getAgentDir();
				const modelsPath = join(agentDir, "models.yml");

				let existing: Record<string, unknown> = {};
				if (existsSync(modelsPath)) {
					try {
						const content = readFileSync(modelsPath, "utf-8");
						existing = (YAML.parse(content) as Record<string, unknown>) ?? {};
					} catch { existing = {}; }
				}

				const providers = (existing.providers ?? {}) as Record<string, unknown>;
				const providerName = deriveProviderName(baseUrl);

				const providerConfig: Record<string, unknown> = {
					baseUrl,
					api: apiType,
					auth: "apiKey",
					apiKey: apiKey.trim(),
				};

				// Auto-detect models for OpenAI-compatible
				if (apiType === "openai-completions" || apiType === "openai-responses") {
					process.stdout.write(`  ${chalk.dim("Detecting models…")}\n`);
					try {
						const headers: Record<string, string> = {};
						if (apiKey.trim()) headers["Authorization"] = `Bearer ${apiKey.trim()}`;
						const res = await fetch(`${baseUrl}/models`, { headers, signal: AbortSignal.timeout(10_000) });
						if (res.ok) {
							const data = (await res.json()) as { data?: { id: string }[] };
							if (data.data?.length) {
								const models = data.data.map(m => m.id).filter(Boolean).sort();
								providerConfig.models = models.map(id => ({
									id,
									api: apiType,
									contextWindow: 128000,
									supportsTools: true,
								}));
								process.stdout.write(`  ${chalk.green("✓")} ${models.length} model${models.length !== 1 ? "s" : ""} detected\n`);
							} else {
								process.stdout.write(`  ${chalk.dim("No models listed at /models endpoint (provider may not support it)")}\n`);
							}
						} else {
							process.stdout.write(`  ${chalk.dim(`Could not detect models (HTTP ${res.status}) — manual config may be needed`)}\n`);
						}
					} catch {
						process.stdout.write(`  ${chalk.dim("Could not reach /models endpoint — saved without model list")}\n`);
					}
				}

				providers[providerName] = providerConfig;
				existing.providers = providers;

				if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
				writeFileSync(modelsPath, YAML.stringify(existing), "utf-8");
				process.stdout.write(`  ${chalk.green("✓")} Provider saved to ${modelsPath}\n`);
			} catch (err) {
				process.stdout.write(`  ${chalk.dim(`Could not save provider config: ${(err as Error).message}`)}\n`);
			}
		} else {
			process.stdout.write(`  ${chalk.dim("Skipped — set OPENAI_API_KEY or ANTHROPIC_API_KEY env var to connect later")}\n`);
		}

		rl.close();

		const cfg = defaultConfigFn();
		cfg.memory = { ...cfg.memory, backend };
		saveConfig(cfg);
		process.stdout.write(`✓ created ${path} (memory backend: ${backend})\n`);
		return 0;
	} catch (err) {
		process.stderr.write(`✗ init failed: ${(err as Error).message}\n`);
		return 1;
	}
}

async function cmdChat(_args: string[]): Promise<number> {
	const cfg = loadConfig();
	const { runEchoChat } = await import("../tui/chat-ui.js");
	await runEchoChat({
		model: cfg?.model.model,
		provider: cfg?.model.provider,
		version: PKG_VERSION,
		agentName: cfg?.agentName ?? "SnsCoder",
	});
	return 0;
}



function cmdConfigShow(cfg: Config): number {
	process.stdout.write(JSON.stringify(cfg, null, 2) + "\n");
	return 0;
}

function cmdConfigGet(cfg: Config, key: string): number {
	const value = getByPath(cfg as unknown as Record<string, unknown>, key);
	if (value === undefined) {
		process.stderr.write(`✗ key not found: ${key}\n`);
		return 1;
	}
	if (typeof value === "string") {
		process.stdout.write(value + "\n");
	} else {
		process.stdout.write(JSON.stringify(value, null, 2) + "\n");
	}
	return 0;
}

function cmdConfigSet(cfg: Config, key: string, valueRaw: string): number {
	let value: unknown = valueRaw;
	// Try to parse as JSON so numbers/booleans/arrays work.
	if (valueRaw === "true") value = true;
	else if (valueRaw === "false") value = false;
	else if (valueRaw !== "" && !Number.isNaN(Number(valueRaw))) value = Number(valueRaw);
	else if (valueRaw.startsWith("[") || valueRaw.startsWith("{")) {
		try {
			value = JSON.parse(valueRaw);
		} catch {
			/* keep as string */
		}
	}
	const ok = setByPath(cfg as unknown as Record<string, unknown>, key, value);
	if (!ok) {
		process.stderr.write(`✗ cannot set unknown key: ${key}\n`);
		return 1;
	}
	try {
		saveConfig(cfg);
		process.stdout.write(`✓ ${key} updated\n`);
		return 0;
	} catch (err) {
		process.stderr.write(`✗ save failed: ${(err as Error).message}\n`);
		return 1;
	}
}

function cmdConfig(args: string[]): number {
	const cfg = loadConfig();
	if (!cfg) {
		process.stderr.write("✗ no config found, run `snsagent init` first\n");
		return 1;
	}
	const sub = args[0];
	if (!sub || sub === "show") {
		return cmdConfigShow(cfg);
	}
	if (sub === "get") {
		const key = args[1];
		if (!key) {
			process.stderr.write("✗ usage: snsagent config get <key>\n");
			return 1;
		}
		return cmdConfigGet(cfg, key);
	}
	if (sub === "set") {
		const key = args[1];
		const value = args[2];
		if (!key || value === undefined) {
			process.stderr.write("✗ usage: snsagent config set <key> <value>\n");
			return 1;
		}
		return cmdConfigSet(cfg, key, value);
	}
	process.stderr.write(`✗ unknown config subcommand: ${sub}\n`);
	return 1;
}

// ---------- telegram adapter ----------

interface TelegramOptions {
	token?: string;
}

function parseFlag(args: string[], name: string): string | undefined {
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === `--${name}` && i + 1 < args.length) return args[i + 1];
		if (a && a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
	}
	return undefined;
}

async function cmdTelegram(args: string[]): Promise<number> {
	const sub = args[0];
	if (!sub || sub === "--help" || sub === "-h") {
		process.stdout.write(TG_HELP);
		return 0;
	}
	if (sub === "status") {
		const cfg = loadConfig();
		if (!cfg) {
			process.stderr.write("✗ no config found, run `snsagent init` first\n");
			return 1;
		}
		const envToken = process.env.SNS_TELEGRAM_BOT_TOKEN;
		const cfgToken = cfg.telegram.token;
		const hasToken = Boolean((envToken && envToken.length > 0) || (cfgToken && cfgToken.length > 0));
		process.stdout.write(
			`adapter: polling (grammY)\n` +
				`autostart env: ${process.env.SNS_TELEGRAM_AUTOSTART ?? "(unset, default on)"}\n` +
				`token env: ${envToken ? "set" : "unset"}\n` +
				`token config: ${cfgToken ? "set" : "empty"}\n` +
				`effective: ${hasToken ? "configured" : "not configured"}\n` +
				`pollIntervalMs: ${cfg.telegram.pollIntervalMs}\n`,
		);
		return 0;
	}
	if (sub === "start") {
		const opts = parseTelegramOpts(args.slice(1));
		const token = opts.token ?? process.env.SNS_TELEGRAM_BOT_TOKEN;
		if (!token) {
			process.stderr.write(
				"✗ no token: pass --token <TOKEN> or set SNS_TELEGRAM_BOT_TOKEN\n",
			);
			return 2;
		}
		process.stdout.write(`snsagent telegram: starting polling bot...\n`);
		// Probe the token first so a bogus token exits cleanly with a
		// readable error instead of triggering an UnhandledRejection
		// from grammY's internal polling loop.
		const probe = await probeTelegramToken(token);
		if (!probe.ok) {
			process.stderr.write(`✗ telegram start: ${probe.error}\n`);
			return 1;
		}

		// Wire the agent bridge — per-chat sessions via createAgentSession()
		const agentForwarder = createForwardToAgent();
		// Adapt 3-arg bridge to 2-arg handler signature: (text, sessionKey) → string
		const forwardToAgent = (text: string, sessionKey: string) =>
			agentForwarder(sessionKey, "telegram", text);

		const bot = startTelegramAdapter(token, {
			autostart: true,
			forwardToAgent,
			resetChatSession,
			getBridgeStats,
		});
		if (!bot) {
			process.stderr.write("✗ autostart refused by adapter\n");
			return 1;
		}
		process.stdout.write(
			`✓ telegram polling online as @${probe.username ?? "?"} (Ctrl-C to stop)\n`,
		);
		// Park the process; SIGINT/SIGTERM handled by adapter.
		await new Promise<number>(() => {});
		return 0;
	}
	if (sub === "stop") {
		await stopTelegramAdapter();
		process.stdout.write("✓ telegram adapter stopped\n");
		return 0;
	}
	process.stderr.write(`✗ unknown telegram subcommand: ${sub}\n${TG_HELP}`);
	return 1;
}

function parseTelegramOpts(args: string[]): TelegramOptions {
	return { token: parseFlag(args, "token") };
}

const TG_HELP = `Usage: snsagent telegram <subcommand>

Subcommands:
  start [--token <TOKEN>]   start the polling bot (token: flag > env > config)
  stop                      stop the polling bot
  status                    show adapter + token state
  --help                    this help

Env:
  SNS_TELEGRAM_BOT_TOKEN    bot token from @BotFather
  SNS_TELEGRAM_AUTOSTART    set to "0" to disable autostart on CLI launch
`;

interface ProbeResult {
	readonly ok: boolean;
	readonly username?: string;
	readonly error?: string;
}

/**
 * Verify a Telegram bot token by calling the public `getMe` endpoint.
 * Uses only Node built-ins (no grammY) so a bad token yields a clean
 * stderr message + exit 1, not an UnhandledRejection from the polling loop.
 */
async function probeTelegramToken(token: string): Promise<ProbeResult> {
	const url = `https://api.telegram.org/bot${token}/getMe`;
	try {
		const res = await fetch(url, { method: "POST" });
		const data = (await res.json()) as { ok?: boolean; result?: { username?: string }; description?: string };
		if (!data.ok) {
			return { ok: false, error: data.description ?? `HTTP ${res.status}` };
		}
		return { ok: true, username: data.result?.username };
	} catch (err) {
		return { ok: false, error: (err as Error).message };
	}
}

// ---------- tiny dot-path helpers ----------

function getByPath(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let cur: unknown = obj;
	for (const p of parts) {
		if (cur === null || typeof cur !== "object") return undefined;
		cur = (cur as Record<string, unknown>)[p];
	}
	return cur;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): boolean {
	const parts = path.split(".");
	let cur: Record<string, unknown> = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const p = parts[i]!;
		const next = cur[p];
		if (next === null || typeof next !== "object" || Array.isArray(next)) return false;
		cur = next as Record<string, unknown>;
	}
	const last = parts[parts.length - 1]!;
	if (!(last in cur)) return false;
	cur[last] = value;
	return true;
}

// ---------- router ----------

const HELP = `Usage: snsagent [command] [options]

If no command is given, starts the full agent interactive mode.

Commands:
  (none)                      start full agent interactive mode (default)
  agent                       alias for default
  version                     print package version
  init                        create .sns-myagent/config.json + connect AI provider
  setup                       alias for init (BYOK provider setup)
  chat [--stub]               start interactive chat (stub for Phase 2B)
  launch                      alias for default
  config show                 print current config
  config get <key>            read a dot-path value (e.g. model.provider)
  config set <key> <value>    update a dot-path value
  telegram start|stop|status  manage the Telegram polling adapter
  orchestrate <prompt>        multi-agent ensemble run (Phase 5)
  help                        print this help
`;

export async function runCliAsync(argv: string[]): Promise<number> {
	const [cmd, ...rest] = argv;
	switch (cmd) {
		case undefined:
		case "agent":
		case "launch":
			// No-arg `snsagent` (or explicit `agent`/`launch`) → start full agent mode.
			return cmdLaunch(rest);
		case "help":
		case "--help":
		case "-h":
			process.stdout.write(HELP);
			return 0;
		case "version":
		case "--version":
		case "-v":
			return cmdVersion();
		case "init":
		case "setup":
			return cmdInit();
		case "chat":
			return cmdChat(rest);
		case "config":
			return cmdConfig(rest);
		case "telegram":
			return cmdTelegram(rest);
		case "launch":
			return cmdLaunch(rest);
		case "orchestrate":
			return cmdOrchestrate(rest);
		default:
			process.stderr.write(`✗ unknown command: ${cmd}\n`);
			process.stderr.write(HELP);
			return 1;
	}
}

async function cmdOrchestrate(args: string[]): Promise<number> {
	if (args.length === 0) {
		process.stderr.write("✗ orchestrate requires a prompt\n");
		process.stderr.write("  usage: snsagent orchestrate <prompt>\n");
		process.stderr.write("  flags:  --strategy consensus|critic|best_of_n\n");
		process.stderr.write("          --agents role1,role2\n");
		process.stderr.write("          --ensemble <name>   (from agents.yaml)\n");
		return 1;
	}
	const prompt = args.join(" ");
	const opts: Record<string, unknown> = {};
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--strategy") opts.strategy = args[++i];
		else if (a === "--agents") opts.agents = (args[++i] ?? "").split(",").filter(Boolean);
		else if (a === "--ensemble") opts.ensemble = args[++i];
	}
	void prompt; void opts; // parsed for future executor wiring (Task 5.1d)
	try {
		// CLI wrapper: no real LLM executor yet (Phase 5 stub).
		// Until agent invocation is wired, surface a clear message instead of silently failing.
		process.stderr.write(
			"✗ orchestrate: agent executor not wired in CLI yet.\n" +
				"  Phase 5 ships the orchestrator module; the CLI integration lands once\n" +
				"  the LLM agent executor (src/agents/executor.ts) is implemented.\n" +
				"  For now use the ensemble module directly: import { executeEnsemble } from \"../agents/ensemble.js\".\n",
		);
		return 2;
	} catch (err) {
		process.stderr.write(`✗ orchestrate failed: ${(err as Error).message}\n`);
		return 1;
	}
}

async function cmdLaunch(args: string[]): Promise<number> {
	const { main } = await import("../main.js");
	await main(args);
	return 0;
}

export function runCli(argv: string[]): Promise<number> {
	return runCliAsync(argv);
}

/**
 * Ensure config exists before running a command that needs it.
 * Convenience wrapper for the bin entry.
 */
export function bootstrap(): void {
	ensureConfig();
}

export { readPackageVersion };