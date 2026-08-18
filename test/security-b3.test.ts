/**
 * B3 — Memory & cache poisoning.
 *
 * 1. Cross-session isolation: a fact retained in session A (agentDir A) must
 *    NOT be recalled from session B (different agentDir).
 * 2. Response cache: exact-hit behavior, semantic false-positive risk on
 *    single-word queries, TTL expiry, and overwrite (invalidation) semantics.
 * 3. Tombstone: tombstoned messages must not re-enter the conversation
 *    verbatim; originals stay retrievable via lookup (by design).
 */
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ResponseCache } from "../src/tbm/response-cache";
import { ConversationTombstoner } from "../src/tbm/tombstone";
import { Settings } from "../src/config/settings";
import { mnemopiBackend } from "../src/mnemopi/backend";
import { loadMnemopiConfig } from "../src/mnemopi/config";
import { loadMnemopi, loadMnemopiCore, MnemopiSessionState, setMnemopiSessionState } from "../src/mnemopi/state";

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sns-bughunt-b3-"));
}

function makeSettings(agentDir: string, dbPath: string): Settings {
	return Settings.isolated({
		"memory.backend": "mnemopi",
		"mnemopi.dbPath": dbPath,
		"mnemopi.noEmbeddings": true,
		"mnemopi.llmMode": "none",
		"mnemopi.autoRecall": false,
		"mnemopi.autoRetain": false,
	});
}

let mnemopiReady: Promise<void> | undefined;
function ensureMnemopiLoaded(): Promise<void> {
	mnemopiReady ??= Promise.all([loadMnemopi(), loadMnemopiCore()]).then(() => {});
	return mnemopiReady;
}

// Minimal session surface the mnemopi state needs, matching the production
// integration test harness.
function makeSession(sessionId: string, settings: Settings): { session: unknown } {
	return {
		session: {
			sessionId,
			settings,
			sessionManager: { getEntries: () => [], getCwd: () => "/tmp" },
			subscribe: () => () => {},
			refreshBaseSystemPrompt: async () => {},
		},
	};
}

describe("B3.1 cross-session memory isolation (mnemopi)", () => {
	test("fact stored in agentDir A is NOT recalled from agentDir B", async () => {
		await ensureMnemopiLoaded();
		const agentA = makeTempDir();
		const agentB = makeTempDir();
		const dbA = path.join(agentA, "banks", "bank-a", "mnemopi.db");
		const dbB = path.join(agentB, "banks", "bank-b", "mnemopi.db");
		try {
			// Session A — store a secret fact.
			const settingsA = makeSettings(agentA, dbA);
			const { session: sessionA } = makeSession("sess-A", settingsA);
			const stateA = new MnemopiSessionState({
				sessionId: "sess-A",
				config: loadMnemopiConfig(settingsA, agentA),
				session: sessionA as never,
			});
			setMnemopiSessionState(sessionA as never, stateA);
			const saveRes = await mnemopiBackend.save?.(
				{ agentDir: agentA, cwd: "/tmp", session: sessionA as never },
				{ content: "the secret deploy token prefix is K7X9", importance: 0.95 },
			);
			assert.equal(saveRes?.stored, 1, "save in A should store the fact");

			// Session B — different agentDir + dbPath. Must not see A's fact.
			const settingsB = makeSettings(agentB, dbB);
			const { session: sessionB } = makeSession("sess-B", settingsB);
			const stateB = new MnemopiSessionState({
				sessionId: "sess-B",
				config: loadMnemopiConfig(settingsB, agentB),
				session: sessionB as never,
			});
			setMnemopiSessionState(sessionB as never, stateB);

			const searchB = await mnemopiBackend.search?.(
				{ agentDir: agentB, cwd: "/tmp", session: sessionB as never },
				"deploy token prefix",
			);
			const textB = JSON.stringify(searchB ?? {});
			assert.ok(!textB.includes("K7X9"), `session B must not see A's fact: ${textB.slice(0, 200)}`);

			// Control: A still sees its own fact.
			const searchA = await mnemopiBackend.search?.(
				{ agentDir: agentA, cwd: "/tmp", session: sessionA as never },
				"deploy token prefix",
			);
			const textA = JSON.stringify(searchA ?? {});
			assert.ok(textA.includes("K7X9"), `session A should recall its own fact: ${textA.slice(0, 200)}`);

			await stateA.dispose({ consolidate: false });
			await stateB.dispose({ consolidate: false });
		} finally {
			fs.rmSync(agentA, { recursive: true, force: true });
			fs.rmSync(agentB, { recursive: true, force: true });
		}
	});
});

describe("B3.2 response cache", () => {
	test("exact hit returns the cached response", () => {
		const cache = new ResponseCache();
		cache.set("what is the capital of France", "Paris");
		const r = cache.get("What is the capital of France");
		assert.equal(r.hit, true);
		assert.equal(r.response, "Paris");
		assert.equal(r.matchType, "exact");
	});

	test("overwrite invalidates the old response for the same query", () => {
		const cache = new ResponseCache();
		cache.set("deploy now", "OLD-STALE-RESPONSE");
		cache.set("deploy now", "NEW-CORRECT-RESPONSE");
		const r = cache.get("deploy now");
		assert.equal(r.response, "NEW-CORRECT-RESPONSE", "latest write must win");
	});

	test("semantic match can false-positive on single-word queries", () => {
		// Both queries are single words → zero bigrams → jaccardSimilarity
		// returns 1.0 (both-empty branch), so ANY single-word query matches
		// ANY other single-word query.
		const cache = new ResponseCache();
		cache.set("deploy", "RESPONSE-FOR-DEPLOY");
		const r = cache.get("status");
		assert.equal(r.hit, true, "unrelated single-word query hits semantically");
		assert.equal(r.response, "RESPONSE-FOR-DEPLOY");
	});

	test("TTL expiry invalidates entries", () => {
		const cache = new ResponseCache(1 /* ttl seconds */);
		cache.set("q1", "r1");
		// Fake clock: rely on the lazily cleaned expiry path via a 1.2s wait.
		return new Promise<void>((resolvePromise) => {
			setTimeout(() => {
				const r = cache.get("q1");
				assert.equal(r.hit, false, "entry must expire after TTL");
				resolvePromise();
			}, 1250);
		});
	});

	test("clear() drops everything", () => {
		const cache = new ResponseCache();
		cache.set("q1", "r1");
		cache.clear();
		assert.equal(cache.get("q1").hit, false);
	});
});

describe("B3.3 tombstone", () => {
	test("tombstoned messages do not re-enter verbatim", () => {
		const tombstoner = new ConversationTombstoner(10, 3);
		// Multi-sentence messages so the heuristic summary is genuinely shorter
		// than the original (realistic long-message compression case).
		const msgs = Array.from({ length: 30 }, (_, i) => ({
			role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
			content: `message number ${i} with a long body of padding content. This sentence adds more context about the deployment pipeline and the rollback procedure that we discussed earlier in the session. And yet another sentence describing the expected behavior under failure so the summary heuristic only keeps the first sentence.`,
		}));
		const { compressed, tombstoned, tokensSaved } = tombstoner.tombstone(msgs);
		assert.equal(tombstoned, 27);
		assert.ok(tokensSaved > 0, "multi-sentence messages must yield real token savings");

		const joined = compressed.map(m => m.content).join("\n");
		// Old verbatim messages (0..26) must not reappear in full. The tombstone
		// summary intentionally keeps the first sentence, so check the FULL
		// original content (which includes the trailing sentences) never
		// reappears.
		for (let i = 0; i < 27; i++) {
			assert.ok(
				!joined.includes(msgs[i].content),
				`verbatim message ${i} leaked back`,
			);
		}
		// Recent tail survives verbatim.
		assert.ok(joined.includes(msgs[29].content));
	});

	test("REG: tokensSaved is clamped >= 0 even when summaries do not compress", () => {
		// Single-sentence messages make the heuristic summary nearly as long as
		// the original (+5 formatting overhead) — the raw difference is
		// negative. The reported savings must be clamped to 0, never negative,
		// and the compression ratio must never exceed 1.
		const tombstoner = new ConversationTombstoner(2, 1);
		const msgs = Array.from({ length: 6 }, (_, i) => ({
			role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
			content: `short single sentence number ${i} that cannot compress`, 
		}));
		const { tombstoned, tokensSaved } = tombstoner.tombstone(msgs);
		assert.ok(tombstoned > 0, "messages should still be tombstoned");
		assert.ok(tokensSaved >= 0, `tokensSaved must never be negative, got ${tokensSaved}`);
		assert.ok(tombstoner.stats.tokensSaved >= 0, "accumulated stats must never be negative");
		assert.ok(
			tombstoner.stats.compressionRatio <= 1,
			`compression ratio must never exceed 1, got ${tombstoner.stats.compressionRatio}`,
		);
	});

	test("originals remain retrievable by hash (by design)", () => {
		const tombstoner = new ConversationTombstoner(5, 2);
		const msgs = [
			{ role: "user" as const, content: "the API key is AKIA123456" },
			{ role: "assistant" as const, content: "ok, noted" },
			{ role: "user" as const, content: "next task" },
			{ role: "assistant" as const, content: "done" },
			{ role: "user" as const, content: "more" },
			{ role: "assistant" as const, content: "sure" },
			{ role: "user" as const, content: "extra one" },
			{ role: "assistant" as const, content: "extra two" },
			{ role: "user" as const, content: "extra three" },
			{ role: "assistant" as const, content: "extra four" },
		];
		const { tombstoned } = tombstoner.tombstone(msgs);
		assert.ok(tombstoned > 0);
		// The tombstone entry for the first message exists and the original is
		// stored for lookup — this is the documented compression contract.
		const entry = tombstoner.entries[0];
		assert.ok(entry);
		const original = tombstoner.lookupOriginal(entry.originalHash);
		assert.equal(original, msgs[0].content);
	});
});
