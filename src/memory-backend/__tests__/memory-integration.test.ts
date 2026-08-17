/**
 * Memory integration tests — prove the real path, not file existence.
 *
 * Path under test (mnemopi backend):
 *   user input → retain → SQLite persistence → new state/process → recall
 *   → context injection (beforeAgentStartPrompt / buildDeveloperInstructions)
 *   → model context
 *
 * The mnemopi backend is exercised against a real temp SQLite database with
 * `noEmbeddings: true` (lexical matching) and `llmMode: none` so the tests
 * are hermetic — no network, no model API keys.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, setDefaultTimeout, test } from "bun:test";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { Settings } from "../../config/settings";
import { resolveMemoryBackend } from "../resolve";
import { lcmBackend } from "../lcm-backend";
import { localBackend } from "../local-backend";
import { mem0Backend } from "../mem0-backend";
import { mnemosyneBackend } from "../mnemosyne-backend";
import { mnemopiBackend } from "../../mnemopi/backend";
import { loadMnemopiConfig } from "../../mnemopi/config";
import { loadMnemopi, loadMnemopiCore, MnemopiSessionState, setMnemopiSessionState } from "../../mnemopi/state";

// The mnemopi module graph pulls the embeddings stack and starts slowly under
// `bun test --parallel=4` CPU contention. Raising the file default and
// preloading once in beforeAll keeps the heavy import out of per-test timers.
setDefaultTimeout(30_000);

// The mnemopi session state requires the mnemopi module graph to be loaded
// before construction (it builds scoped SQLite resources synchronously). The
// real backend does this in `start()` via `loadMnemopiConfigWithProviders`;
// tests do it once per file since the module-level memoization makes it cheap.
let mnemopiReady: Promise<void> | undefined;
async function ensureMnemopiLoaded(): Promise<void> {
	mnemopiReady ??= Promise.all([loadMnemopi(), loadMnemopiCore()]).then(() => {});
	await mnemopiReady;
}

beforeAll(() => ensureMnemopiLoaded());

// The real `mnemopiBackend.start()` attaches the state to the session via
// `setMnemopiSessionState` before any save/search runs. Mirror that here so the
// backend's save/search/clear paths resolve the session state exactly as they
// do in production.
function attachState(session: FakeSessionLike, state: MnemopiSessionState): void {
	setMnemopiSessionState(session as never, state);
}
import type { AgentSessionEvent } from "../../session/agent-session";
import type { SessionEntry } from "../../session/session-entries";

// ────────────────────────────────────────────────────────────────────────────
// Fake session surface — the mnemopi state only needs these members.
// ────────────────────────────────────────────────────────────────────────────

interface FakeSessionLike {
	sessionId: string;
	settings: Settings;
	sessionManager: {
		getEntries(): SessionEntry[];
		getCwd(): string;
	};
	subscribe(listener: (event: AgentSessionEvent) => void): () => void;
	refreshBaseSystemPrompt(): Promise<void>;
	[key: symbol]: unknown;
}

function makeSession(
	settings: Settings,
	entries: SessionEntry[] = [],
	sessionId = `mem-test-${Math.random().toString(36).slice(2, 10)}`,
): { session: FakeSessionLike; emit: (event: AgentSessionEvent) => void } {
	let listener: ((event: AgentSessionEvent) => void) | undefined;
	const session = {
		sessionId,
		settings,
		sessionManager: {
			getEntries: () => entries,
			getCwd: () => "/tmp/mem-test-cwd",
		},
		subscribe: (fn: (event: AgentSessionEvent) => void) => {
			listener = fn;
			return () => {
				listener = undefined;
			};
		},
		refreshBaseSystemPrompt: async () => {},
	};
	return {
		session: session as unknown as FakeSessionLike,
		emit: (event: AgentSessionEvent) => listener?.(event),
	};
}

function userEntry(text: string): SessionEntry {
	return {
		type: "message",
		id: `u-${Math.random().toString(36).slice(2, 8)}`,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: { role: "user", content: text } as AgentMessage,
	};
}

function assistantEntry(text: string): SessionEntry {
	return {
		type: "message",
		id: `a-${Math.random().toString(36).slice(2, 8)}`,
		parentId: null,
		timestamp: new Date().toISOString(),
		message: {
			role: "assistant",
			content: [{ type: "text", text }],
		} as AgentMessage,
	};
}

function makeSettings(agentDir: string, overrides: Record<string, unknown> = {}): Settings {
	return Settings.isolated({
		"memory.backend": "mnemopi",
		"mnemopi.dbPath": join(agentDir, "mnemopi", "mnemopi.db"),
		"mnemopi.noEmbeddings": true,
		"mnemopi.llmMode": "none",
		"mnemopi.scoping": "global",
		...overrides,
	});
}

let tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "sns-memory-test-"));
	tempDirs.push(dir);
	return dir;
}

beforeEach(() => {
	tempDirs = [];
});

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("memory backend resolution", () => {
	test("memory.backend=off resolves to the off backend with no persistence", async () => {
		const settings = Settings.isolated({ "memory.backend": "off" });
		const backend = await resolveMemoryBackend(settings);
		assert.equal(backend.id, "off");
		const status = await backend.status?.({ agentDir: "/tmp", cwd: "/tmp" });
		assert.equal(status?.active, false);
		assert.equal(status?.writable, false);
		assert.equal(status?.searchable, false);
		// off backend has no save path at all
		assert.equal(backend.save, undefined);
		assert.equal(backend.search, undefined);
	});

	test("memory.backend=mnemopi resolves to the mnemopi backend", async () => {
		const settings = Settings.isolated({ "memory.backend": "mnemopi" });
		const backend = await resolveMemoryBackend(settings);
		assert.equal(backend.id, "mnemopi");
	});

	test("memory.backend=local resolves to the local backend", async () => {
		const settings = Settings.isolated({ "memory.backend": "local" });
		const backend = await resolveMemoryBackend(settings);
		assert.equal(backend.id, "local");
	});
});

describe("mnemopi explicit retain + recall (2.1, 2.3)", () => {
	test("save persists a fact and semantic recall finds it", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir);
		const { session } = makeSession(settings);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			// Explicit retain via the backend save path (same code the /memory
			// slash command and the `retain` tool call).
			const saved = await mnemopiBackend.save?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				{ content: "The KIR SMAGA team meets every Wednesday at 15.15 WIB.", importance: 0.9 },
			);
			assert.equal(saved?.stored, 1, "save must report a stored id");

			// Direct search. NOTE: these tests run with `noEmbeddings: true` so
			// recall is lexical — the query must share tokens with the stored
			// fact. Production default (embedding model) does semantic matching;
			// that path is exercised in the running app, not here, because it
			// requires the embedding subprocess/model.
			const result = await mnemopiBackend.search?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				"KIR SMAGA meeting schedule Wednesday",
			);
			assert.ok(result && result.count >= 1, `expected >=1 hit, got ${result?.count}`);
			const joined = (result?.items ?? []).map(item => item.content).join("\n");
			assert.match(joined, /Wednesday|15\.15/i, "recalled content should contain the stored fact");
		} finally {
			await state.dispose({ consolidate: false });
		}
	});

	test("recall does not return unrelated facts (false positive check)", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir);
		const { session } = makeSession(settings);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			await mnemopiBackend.save?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				{ content: "The school library catalog uses decimal classification.", importance: 0.5 },
			);
			const result = await mnemopiBackend.search?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				"what pizza toppings does the user prefer",
			);
			// Lexical mode: unrelated query must not surface the library fact.
			assert.ok(result && result.count === 0, `expected 0 hits for unrelated query, got ${result?.count}`);
		} finally {
			await state.dispose({ consolidate: false });
		}
	});
});

describe("restart persistence (2.2)", () => {
	test("fact stored by process A is recallable by a fresh state (process B)", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir);

		// Process A — store the fact.
		{
			const { session } = makeSession(settings, [], "proc-a");
			const stateA = new MnemopiSessionState({
				sessionId: session.sessionId,
				config: loadMnemopiConfig(settings, agentDir),
				session: session as never,
			});
			attachState(session, stateA);
			await mnemopiBackend.save?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				{ content: "SMAN 3 Jember is located on Jalan Basuki Rahmat.", importance: 0.8 },
			);
			await stateA.dispose({ consolidate: false });
		}

		// Process B — brand-new state object, same DB file on disk.
		{
			const { session } = makeSession(settings, [], "proc-b");
			const stateB = new MnemopiSessionState({
				sessionId: session.sessionId,
				config: loadMnemopiConfig(settings, agentDir),
				session: session as never,
			});
			attachState(session, stateB);
			try {
				const result = await mnemopiBackend.search?.(
					{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
					"where is SMAN 3 Jember",
				);
				assert.ok(result && result.count >= 1, "process B must recall the fact stored by process A");
			} finally {
				await stateB.dispose({ consolidate: false });
			}
		}
	});
});

describe("auto-retain (2.4)", () => {
	test("agent_end with autoRetain on creates memory entries", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir, { "mnemopi.autoRetain": true, "mnemopi.retainEveryNTurns": 1 });
		const entries = [
			userEntry("I prefer the dark theme for the terminal."),
			assistantEntry("Got it, I will remember that preference."),
		];
		const { session, emit } = makeSession(settings, entries);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			state.attachSessionListeners();
			// Simulate the real event the agent loop emits at the end of a turn.
			await emit({ type: "agent_end", messages: [] } as never);
			await state.maybeRetainOnAgentEnd([]);

			const result = await mnemopiBackend.search?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				"terminal theme preference",
			);
			assert.ok(result && result.count >= 1, "auto-retain should have persisted the turn");
			const joined = (result?.items ?? []).map(item => item.content).join("\n");
			assert.match(joined, /dark theme/i, "retained transcript should include the user preference");
		} finally {
			await state.dispose({ consolidate: false });
		}
	});

	test("autoRetain off means agent_end stores nothing", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir, { "mnemopi.autoRetain": false });
		const entries = [userEntry("This fact must not be auto-retained."), assistantEntry("Understood.")];
		const { session, emit } = makeSession(settings, entries);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			state.attachSessionListeners();
			await emit({ type: "agent_end", messages: [] } as never);
			await state.maybeRetainOnAgentEnd([]);
			const result = await mnemopiBackend.search?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				"must not be auto-retained",
			);
			assert.equal(result?.count, 0, "autoRetain off must not persist anything");
		} finally {
			await state.dispose({ consolidate: false });
		}
	});
});

describe("auto-recall + context injection (2.5, 2.6)", () => {
	test("beforeAgentStartPrompt injects a recalled memory block on first turn", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir, { "mnemopi.autoRecall": true });
		const { session } = makeSession(settings);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			// Store a fact first.
			await mnemopiBackend.save?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				{ content: "The user is building a Next.js application called kirsmaga.", importance: 0.95 },
			);
			// Fresh state = fresh session. First-turn prompt must pull the fact.
			const injected = await state.beforeAgentStartPrompt(
				"what project am I working on and what is it called",
			);
			assert.ok(injected, "auto-recall must return an injected block");
			assert.match(injected!, /<memories>/, "injected block must be a <memories> block");
			assert.match(injected!, /kirsmaga/i, "injected block must contain the recalled fact");
			assert.equal(state.hasRecalledForFirstTurn, true, "first-turn recall must be marked done");
		} finally {
			await state.dispose({ consolidate: false });
		}
	});

	test("beforeAgentStartPrompt does not re-inject on subsequent turns", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir, { "mnemopi.autoRecall": true });
		const { session } = makeSession(settings);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			await mnemopiBackend.save?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				{ content: "Deployment target is a VPS on port 3210.", importance: 0.9 },
			);
			const first = await state.beforeAgentStartPrompt("where do we deploy");
			assert.ok(first, "first turn must inject");
			const second = await state.beforeAgentStartPrompt("where do we deploy again");
			assert.equal(second, undefined, "second turn must not re-inject");
		} finally {
			await state.dispose({ consolidate: false });
		}
	});

	test("injectionTokenLimit truncates buildDeveloperInstructions output", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const tiny = 256;
		const settings = makeSettings(agentDir, { "mnemopi.injectionTokenLimit": tiny });
		const { session } = makeSession(settings);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			state.lastRecallSnippet = "x".repeat(50_000);
			const instructions = await mnemopiBackend.buildDeveloperInstructions?.(agentDir, settings, session as never);
			assert.ok(instructions, "buildDeveloperInstructions must return the memory block");
			// truncateApproxTokens: tokenLimit * 4 chars max (heuristic 4 chars/token).
			assert.ok(
				instructions!.length <= tiny * 4 + 2,
				`injected instructions must respect the token budget, got ${instructions!.length} chars for limit ${tiny}`,
			);
		} finally {
			await state.dispose({ consolidate: false });
		}
	});
});

describe("clear/delete (2.7)", () => {
	test("backend.clear removes persisted memories so they are no longer recallable", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settings = makeSettings(agentDir);
		const { session } = makeSession(settings);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settings, agentDir),
			session: session as never,
		});
		attachState(session, state);
		try {
			await mnemopiBackend.save?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				{ content: "Secret fact that must be wiped: the launch code is 4-8-15-16.", importance: 1 },
			);
			const before = await mnemopiBackend.search?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				"launch code",
			);
			assert.ok(before && before.count >= 1, "fact must exist before clear");

			await mnemopiBackend.clear?.(agentDir, "/tmp/mem-test-cwd", session as never);

			const after = await mnemopiBackend.search?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				"launch code",
			);
			assert.equal(after?.count, 0, "fact must not be recallable after clear");
		} finally {
			await state.dispose({ consolidate: false });
		}
	});
});

describe("scope isolation (2.10)", () => {
	test("per-project scoping keeps project A memory out of project B recall", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const cwdA = join(agentDir, "project-a");
		const cwdB = join(agentDir, "project-b");
		// per-project bank derivation is based on cwd; use separate dbPaths so
		// the two projects cannot share a bank by accident.
		const settingsA = Settings.isolated({
			"memory.backend": "mnemopi",
			"mnemopi.dbPath": join(agentDir, "banks", "bank-a", "mnemopi.db"),
			"mnemopi.scoping": "per-project",
			"mnemopi.noEmbeddings": true,
			"mnemopi.llmMode": "none",
		});
		const settingsB = Settings.isolated({
			"memory.backend": "mnemopi",
			"mnemopi.dbPath": join(agentDir, "banks", "bank-b", "mnemopi.db"),
			"mnemopi.scoping": "per-project",
			"mnemopi.noEmbeddings": true,
			"mnemopi.llmMode": "none",
		});
		const { session: sessionA } = makeSession(settingsA, [], "scope-a");
		const { session: sessionB } = makeSession(settingsB, [], "scope-b");
		const stateA = new MnemopiSessionState({
			sessionId: sessionA.sessionId,
			config: loadMnemopiConfig(settingsA, agentDir),
			session: sessionA as never,
		});
		attachState(sessionA, stateA);
		const stateB = new MnemopiSessionState({
			sessionId: sessionB.sessionId,
			config: loadMnemopiConfig(settingsB, agentDir),
			session: sessionB as never,
		});
		attachState(sessionB, stateB);
		try {
			await mnemopiBackend.save?.(
				{ agentDir, cwd: cwdA, session: sessionA as never },
				{ content: "Project A internal detail: the API key prefix is AKIA-TEST.", importance: 0.9 },
			);
			const leak = await mnemopiBackend.search?.(
				{ agentDir, cwd: cwdB, session: sessionB as never },
				"API key prefix",
			);
			assert.equal(leak?.count, 0, "project B must not recall project A memory");
		} finally {
			await stateA.dispose({ consolidate: false });
			await stateB.dispose({ consolidate: false });
		}
	});
});

describe("backend switching (2.9)", () => {
	test("switching memory.backend from mnemopi to off isolates and stops persistence", async () => {
		await ensureMnemopiLoaded();
		const agentDir = makeTempDir();
		const settingsOn = makeSettings(agentDir);
		const { session } = makeSession(settingsOn);
		const state = new MnemopiSessionState({
			sessionId: session.sessionId,
			config: loadMnemopiConfig(settingsOn, agentDir),
			session: session as never,
		});
		try {
			await mnemopiBackend.save?.(
				{ agentDir, cwd: "/tmp/mem-test-cwd", session: session as never },
				{ content: "Fact stored while backend was mnemopi.", importance: 0.8 },
			);
			// Now switch the same settings to off.
			const settingsOff = Settings.isolated({ "memory.backend": "off" });
			const off = await resolveMemoryBackend(settingsOff);
			assert.equal(off.id, "off");
			assert.equal(off.save, undefined, "off backend must not expose save");
		} finally {
			await state.dispose({ consolidate: false });
		}
	});
});

describe("all memory backends resolve (2.9 backend coverage)", () => {
	const cases = [
		["off", "off"],
		["local", "local"],
		["mnemopi", "mnemopi"],
		["mem0", "mem0"],
		["lcm", "lcm"],
		["hindsight", "hindsight"],
	] as const;
	for (const [backend, expected] of cases) {
		test(`memory.backend=${backend} resolves to the ${expected} backend`, async () => {
			const settings = Settings.isolated({ "memory.backend": backend });
			const resolved = await resolveMemoryBackend(settings);
			assert.equal(resolved.id, expected);
		});
	}

	test("memory.backend=mnemosyne is migrated to mnemopi (mnemosyne backend is dead code)", async () => {
		// `Settings` runs `#migrateRawSettings` on construction (including the
		// isolated path), which rewrites `memory.backend=mnemosyne` -> `mnemopi`.
		// The resolver's `mnemosyneBackend` branch is therefore unreachable
		// through any normal construction path, even though the settings schema
		// still lists `mnemosyne` as a selectable enum value (misleading UI).
		const settings = Settings.isolated({ "memory.backend": "mnemosyne" });
		const resolved = await resolveMemoryBackend(settings);
		assert.equal(resolved.id, "mnemopi", "mnemosyne config value must be migrated to mnemopi");
	});
});

describe("alternative SQLite backends — hermetic save/search/clear", () => {
	test("mem0 persists, recalls, and clears", async () => {
		const agentDir = makeTempDir();
		const ctx = { agentDir, cwd: "/tmp/mem-test-cwd" };
		const saved = await mem0Backend.save?.(ctx, { content: "The user prefers Rust over Go.", importance: 0.9 });
		assert.equal(saved?.stored, 1, "mem0 save must persist a fact");
		const found = await mem0Backend.search?.(ctx, "Rust Go preference");
		assert.ok(found && found.count >= 1, "mem0 must recall the stored fact");
		await mem0Backend.clear(agentDir);
		const after = await mem0Backend.search?.(ctx, "Rust Go preference");
		assert.equal(after?.count, 0, "mem0 clear must remove the fact");
	});

	test("lcm persists, recalls, and clears", async () => {
		const agentDir = makeTempDir();
		const ctx = { agentDir, cwd: "/tmp/mem-test-cwd" };
		const saved = await lcmBackend.save?.(ctx, { content: "Deployment uses a blue-green strategy.", importance: 0.7 });
		assert.equal(saved?.stored, 1, "lcm save must persist a delta");
		const found = await lcmBackend.search?.(ctx, "deployment strategy");
		assert.ok(found && found.count >= 1, "lcm must recall the stored delta");
		await lcmBackend.clear(agentDir);
		const after = await lcmBackend.search?.(ctx, "deployment strategy");
		assert.equal(after?.count, 0, "lcm clear must remove the delta");
	});

	test("mnemosyne persists (semantic tier for high importance), recalls, and clears", async () => {
		const agentDir = makeTempDir();
		const ctx = { agentDir, cwd: "/tmp/mem-test-cwd" };
		const saved = await mnemosyneBackend.save?.(ctx, { content: "The API listens on port 8080.", importance: 0.9 });
		assert.equal(saved?.stored, 1, "mnemosyne save must persist a fact");
		const found = await mnemosyneBackend.search?.(ctx, "API port");
		assert.ok(found && found.count >= 1, "mnemosyne must recall the stored fact");
		await mnemosyneBackend.clear(agentDir);
		const after = await mnemosyneBackend.search?.(ctx, "API port");
		assert.equal(after?.count, 0, "mnemosyne clear must remove the fact");
	});

	test("mem0 isolates separate agent directories (scope isolation)", async () => {
		const dirA = makeTempDir();
		const dirB = makeTempDir();
		await mem0Backend.save?.({ agentDir: dirA, cwd: "/tmp/a" }, { content: "Project A secret: AKIA-TEST-A.", importance: 0.9 });
		const leak = await mem0Backend.search?.({ agentDir: dirB, cwd: "/tmp/b" }, "AKIA-TEST-A");
		assert.equal(leak?.count, 0, "project B must not see project A's mem0 facts");
	});
});

describe("local backend — manual save only", () => {
	test("local backend reports a successful learned-lesson save", async () => {
		const agentDir = makeTempDir();
		const saved = await localBackend.save?.(
			{ agentDir, cwd: "/tmp/mem-test-cwd" },
			{ content: "Prefer zod v4 for new schemas." },
		);
		assert.equal(saved?.stored, 1, "local save must report success");
		assert.match(saved?.message ?? "", /learned\.md/, "local save must reference learned.md");
		const status = await localBackend.status?.({ agentDir, cwd: "/tmp/mem-test-cwd" });
		assert.equal(status?.active, true);
		assert.equal(status?.writable, true);
	});
});

describe("hindsight backend — config-gated", () => {
	test("hindsight with default apiUrl (localhost:8888) emits static instructions", async () => {
		const settings = Settings.isolated({ "memory.backend": "hindsight" });
		const backend = await resolveMemoryBackend(settings);
		assert.equal(backend.id, "hindsight");
		const instructions = await backend.buildDeveloperInstructions("/tmp", settings, undefined);
		// `hindsight.apiUrl` schema default is http://localhost:8888, so hindsight
		// is considered configured out of the box and emits its static block.
		assert.ok(instructions && /long-term memory/.test(instructions), "default hindsight emits instructions");
	});

	test("hindsight with an explicitly empty apiUrl is inert (no injected instructions)", async () => {
		const settings = Settings.isolated({ "memory.backend": "hindsight", "hindsight.apiUrl": "" });
		const backend = await resolveMemoryBackend(settings);
		assert.equal(backend.id, "hindsight");
		const instructions = await backend.buildDeveloperInstructions("/tmp", settings, undefined);
		assert.equal(instructions, undefined, "hindsight must not emit instructions without apiUrl");
	});
});

describe("auto-recall injection coverage (2.5) — documented gap", () => {
	// The full recall→inject→model path (beforeAgentStartPrompt +
	// preCompactionContext) is implemented for mnemopi and hindsight only.
	// mem0 / lcm / mnemosyne / local inject only STATIC developer instructions
	// via buildDeveloperInstructions; they do not auto-recall into a fresh
	// turn and do not auto-retain turns. This test locks the gap so it cannot
	// regress silently while the limitation is still documented.
	test("mem0/lcm/mnemosyne/local expose no auto-recall/auto-retain hook", async () => {
		for (const backend of [mem0Backend, lcmBackend, mnemosyneBackend, localBackend]) {
			assert.equal(
				backend.beforeAgentStartPrompt,
				undefined,
				`${backend.id} must not claim first-turn auto-recall injection`,
			);
			assert.equal(
				backend.preCompactionContext,
				undefined,
				`${backend.id} must not claim compaction-time recall`,
			);
		}
	});

	test("mnemopi and hindsight DO expose the auto-recall injection hook", async () => {
		assert.equal(typeof mnemopiBackend.beforeAgentStartPrompt, "function", "mnemopi must inject on first turn");
		assert.equal(typeof mnemopiBackend.preCompactionContext, "function", "mnemopi must recall on compaction");
		const hindsight = await resolveMemoryBackend(Settings.isolated({ "memory.backend": "hindsight" }));
		assert.equal(typeof hindsight.beforeAgentStartPrompt, "function", "hindsight must inject on first turn");
	});
});
