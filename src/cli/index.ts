/**
 * SNS-MyAgent Phase 2A CLI — minimal router.
 *
 * Commands:
 *   snscoder version               print package version
 *   snscoder init                  create .sns-myagent/config.json with defaults
 *   snscoder chat [--stub]         start interactive chat (stub for Phase 2B)
 *   snscoder config [show|get k|set k v]   show / read / write config values
 *   snscoder help                  this help
 *
 * No external parser — manual argv handling, zero new deps.
 */

import { loadConfig, saveConfig, configPath, ensureConfig } from "../config/loader.js";
import type { Config } from "../config/schema.js";
import { defaultConfigFn } from "../config/loader.js";
import { startTelegramAdapter, stopTelegramAdapter } from "../adapters/telegram/index.js";

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
		return fromDefine;
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
	process.stdout.write(`snscoder ${PKG_VERSION}\n`);
	return 0;
}

function cmdInit(): number {
	const path = configPath();
	try {
		const existing = loadConfig();
		if (existing) {
			process.stdout.write(`✓ config already exists at ${path}\n`);
			return 0;
		}
		const cfg = defaultConfigFn();
		saveConfig(cfg);
		process.stdout.write(`✓ created ${path}\n`);
		return 0;
	} catch (err) {
		process.stderr.write(`✗ init failed: ${(err as Error).message}\n`);
		return 1;
	}
}

function cmdChat(args: string[]): number {
	const stub = args.includes("--stub");
	process.stdout.write("snscoder chat — interactive mode\n");
	if (stub) {
		process.stdout.write("(stub mode: memory wiring arrives in Phase 2B)\n");
	}
	const cfg = loadConfig();
	if (!cfg) {
		process.stdout.write("! no config found, run `snscoder init` first\n");
		process.stdout.write("  starting with in-memory defaults for this session\n");
	} else {
		process.stdout.write(`model: ${cfg.model.provider}/${cfg.model.model}\n`);
		process.stdout.write("type 'exit' to quit\n");
	}
	// Readline-style loop using readline from Node built-ins.
	return runReadlineLoop(cfg);
}

async function readLine(prompt: string): Promise<string> {
	const { createInterface } = await import("node:readline/promises");
	const { stdin, stdout } = await import("node:process");
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const answer = await rl.question(prompt);
		return answer;
	} finally {
		rl.close();
	}
}

function runReadlineLoop(cfg: Config | null): number {
	// Synchronous-ish loop using readline question/await via deasync-free path.
	// Keep it simple: each turn re-creates the interface so SIGINT cleanly closes it.
	const modelLabel = cfg ? `${cfg.model.provider}/${cfg.model.model}` : "defaults";
	process.stdout.write(`[${modelLabel}] ready.\n`);
	void (async () => {
		while (true) {
			let line: string;
			try {
				line = await readLine("you> ");
			} catch {
				process.stdout.write("\n");
				break;
			}
			const trimmed = line.trim();
			if (trimmed === "" || trimmed === "exit" || trimmed === "quit") {
				process.stdout.write("bye.\n");
				break;
			}
			process.stdout.write(`echo: ${trimmed}\n`);
		}
		// Explicit exit so the process actually terminates.
		process.exit(0);
	})();
	// Return a non-zero so Node keeps the event loop alive until readline ends.
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
		process.stderr.write("✗ no config found, run `snscoder init` first\n");
		return 1;
	}
	const sub = args[0];
	if (!sub || sub === "show") {
		return cmdConfigShow(cfg);
	}
	if (sub === "get") {
		const key = args[1];
		if (!key) {
			process.stderr.write("✗ usage: snscoder config get <key>\n");
			return 1;
		}
		return cmdConfigGet(cfg, key);
	}
	if (sub === "set") {
		const key = args[1];
		const value = args[2];
		if (!key || value === undefined) {
			process.stderr.write("✗ usage: snscoder config set <key> <value>\n");
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
			process.stderr.write("✗ no config found, run `snscoder init` first\n");
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
		process.stdout.write(`snscoder telegram: starting polling bot...\n`);
		// Probe the token first so a bogus token exits cleanly with a
		// readable error instead of triggering an UnhandledRejection
		// from grammY's internal polling loop.
		const probe = await probeTelegramToken(token);
		if (!probe.ok) {
			process.stderr.write(`✗ telegram start: ${probe.error}\n`);
			return 1;
		}
		const bot = startTelegramAdapter(token, { autostart: true });
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

const TG_HELP = `Usage: snscoder telegram <subcommand>

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

const HELP = `Usage: snscoder <command> [options]

Commands:
  version                     print package version
  init                        create .sns-myagent/config.json (defaults)
  chat [--stub]               start interactive chat (stub for Phase 2B)
  config show                 print current config
  config get <key>            read a dot-path value (e.g. model.provider)
  config set <key> <value>    update a dot-path value
  telegram start|stop|status  manage the Telegram polling adapter
  help                        print this help
`;

export async function runCliAsync(argv: string[]): Promise<number> {
	const [cmd, ...rest] = argv;
	switch (cmd) {
		case undefined:
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
			return cmdInit();
		case "chat":
			return cmdChat(rest);
		case "config":
			return cmdConfig(rest);
		case "telegram":
			return cmdTelegram(rest);
		default:
			process.stderr.write(`✗ unknown command: ${cmd}\n`);
			process.stderr.write(HELP);
			return 1;
	}
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