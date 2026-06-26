/**
 * Telegram ↔ Agent bridge.
 *
 * Creates per-chat agent sessions via the SDK `createAgentSession()` API.
 * Each chat ID gets its own persistent session (auto-created on first message).
 *
 * The `createForwardToAgent()` factory returns a `ForwardToAgent` function
 * that the TelegramBot handler calls for every `/chat` and freeform message.
 */

import { createAgentSession, type CreateAgentSessionResult } from "../../sdk.js";
import type { AgentSession } from "../../session/agent-session.js";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { sanitizeText } from "@oh-my-pi/pi-utils";
import { loadConfig } from "../../config/loader.js";
import { initializeExtensions } from "../../modes/runtime-init.js";

/** Internal session record. */
interface ChatRecord {
  result: CreateAgentSessionResult;
  session: AgentSession;
  createdAt: number;
}

/** ForwardToAgent signature — matches handler.ts ForwardToAgent. */
export type ForwardToAgentFn = (
  chatId: string,
  userId: string,
  text: string,
) => Promise<string>;

/**
 * TTL cache: chatId → ChatRecord.
 * Sessions auto-expire after `maxIdleMs` of inactivity.
 */
class SessionCache {
  readonly #cache = new Map<string, ChatRecord>();
  readonly #maxIdleMs: number;

  constructor(maxIdleMs = 30 * 60 * 1000) {
    this.#maxIdleMs = maxIdleMs;
  }

  get(chatId: string): ChatRecord | undefined {
    const rec = this.#cache.get(chatId);
    if (!rec) return undefined;
    // Check idle expiry
    if (Date.now() - rec.createdAt > this.#maxIdleMs) {
      this.#cache.delete(chatId);
      return undefined;
    }
    return rec;
  }

  set(chatId: string, record: ChatRecord): void {
    this.#cache.set(chatId, record);
  }

  delete(chatId: string): void {
    this.#cache.delete(chatId);
  }

  clear(): void {
    this.#cache.clear();
  }

  get size(): number {
    return this.#cache.size;
  }

  keys(): IterableIterator<string> {
    return this.#cache.keys();
  }
}

const sessionCache = new SessionCache();

/**
 * Extract the assistant's text response from a session after prompt().
 */
function extractAssistantText(session: AgentSession): string {
  const msgs = session.state.messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    if (msg && msg.role === "assistant") {
      const asst = msg as AssistantMessage;
      if (asst.stopReason === "error" || asst.stopReason === "aborted") {
        return `⚠️ ${sanitizeText(asst.errorMessage || `Request ${asst.stopReason}`)}`;
      }
      const parts: string[] = [];
      for (const c of asst.content) {
        if (c.type === "text") parts.push(sanitizeText(c.text));
      }
      if (parts.length > 0) return parts.join("\n");
    }
  }
  return "⚠️ No response from agent.";
}

/**
 * Create or retrieve an agent session for a chatId.
 */
async function getOrCreateSession(chatId: string): Promise<AgentSession> {
  const existing = sessionCache.get(chatId);
  if (existing) return existing.session;

  const cfg = loadConfig();
  const cwd = process.cwd();

  const result = await createAgentSession({
    cwd,
    autoApprove: true,
  });

  const session = result.session;

  // Subscribe for persistence (required by print-mode pattern)
  session.subscribe(() => {});

  // Initialize extensions (lightweight, no TUI)
  await initializeExtensions(session, {
    reportSendError: (_action, err) => {
      console.error(`[telegram-bridge] extension error: ${err.message}`);
    },
    reportRuntimeError: (err) => {
      console.error(`[telegram-bridge] runtime error: ${err.error}`);
    },
  });

  sessionCache.set(chatId, {
    result,
    session,
    createdAt: Date.now(),
  });

  console.error(`[telegram-bridge] created session for chat=${chatId} (cache=${sessionCache.size})`);
  return session;
}

/**
 * Create the forwardToAgent function that the TelegramBot handler calls.
 *
 * Usage in CLI:
 *   const forwardToAgent = createForwardToAgent();
 *   startTelegramAdapter(token, { autostart: true, forwardToAgent });
 */
export function createForwardToAgent(): ForwardToAgentFn {
  return async (chatId, _userId, text): Promise<string> => {
    try {
      const session = await getOrCreateSession(chatId);

      // session.prompt() returns true (agent processed) or false (slash-command consumed)
      const handled = await session.prompt(text);

      if (!handled) {
        // Slash command consumed it — no LLM response to return
        return "✅ Command processed.";
      }

      return extractAssistantText(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[telegram-bridge] forwardToAgent error: ${msg}`);
      return `⚠️ Agent error: ${msg}`;
    }
  };
}

/**
 * Reset a specific chat session (for /reset command).
 */
export function resetChatSession(chatId: string): boolean {
  const had = sessionCache.get(chatId) !== undefined;
  sessionCache.delete(chatId);
  return had;
}

/**
 * Get bridge stats (for /status).
 */
export function getBridgeStats(): { activeSessions: number; chatIds: string[] } {
  return {
    activeSessions: sessionCache.size,
    chatIds: [...sessionCache.keys()],
  };
}
