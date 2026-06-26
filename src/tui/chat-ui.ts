/**
 * Chat UI orchestrator — block-style terminal chat loop.
 * Renders messages as bordered blocks, handles /commands, manages conversation.
 * Lightweight: no pi-agent-core dependency. Pure terminal rendering.
 */
import chalk from "chalk";
import gradient from "gradient-string";
import ora from "ora";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { platform } from "node:os";
import { cwd } from "node:process";
import { renderSplash, type SplashInfo } from "./splash.js";
import { renderStatusBar, clearStatusBar, type StatusBarState } from "../ui/status-bar.js";
import {
  renderChatBlock,
  renderToolBlock,
  renderDivider,
  renderSessionHeader,
  type MessageRole,
} from "./chat-blocks.js";

// ── Types ──

interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
  meta?: string;
}

interface ChatSessionConfig {
  model?: string;
  provider?: string;
  version: string;
  agentName?: string;
  tokensUsed?: number;
  memoryHits?: number;
  onUserMessage?: (msg: string) => Promise<string | null>;
}

// ── Helpers ──

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function clearScreen(): void {
  stdout.write("\x1b[2J\x1b[H");
}

function moveCursor(row: number, col: number): void {
  stdout.write(`\x1b[${row};${col}H`);
}

// ── Slash commands ──

interface SlashCommand {
  name: string;
  description: string;
  handler: (args: string[], ctx: ChatContext) => void | Promise<void>;
}

interface ChatContext {
  messages: ChatMessage[];
  config: ChatSessionConfig;
  print: (text: string) => void;
}

const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    name: "/exit",
    description: "Quit the chat",
    handler: (_args, ctx) => {
      ctx.print(chalk.dim("\n  Goodbye. 👋\n"));
      process.exit(0);
    },
  },
  {
    name: "/quit",
    description: "Quit the chat",
    handler: (_args, ctx) => {
      ctx.print(chalk.dim("\n  Goodbye. 👋\n"));
      process.exit(0);
    },
  },
  {
    name: "/clear",
    description: "Clear screen and show header",
    handler: (_args, ctx) => {
      clearScreen();
      const model = ctx.config.model ? `${ctx.config.provider ?? "?"}/${ctx.config.model}` : "none";
      ctx.print(renderSessionHeader(model, ctx.config.version));
    },
  },
  {
    name: "/help",
    description: "Show available commands",
    handler: (_args, ctx) => {
      const lines = BUILTIN_COMMANDS.map(
        c => `  ${chalk.cyan(c.name.padEnd(14))}${chalk.dim(c.description)}`
      ).join("\n");
      ctx.print(renderChatBlock({
        role: "system",
        label: "HELP",
        content: lines,
      }));
    },
  },
  {
    name: "/history",
    description: "Show conversation history",
    handler: (_args, ctx) => {
      if (ctx.messages.length === 0) {
        ctx.print(chalk.dim("  No messages yet."));
        return;
      }
      for (const msg of ctx.messages) {
        ctx.print(renderChatBlock({
          role: msg.role,
          content: msg.content,
          meta: formatTime(msg.timestamp),
        }));
      }
    },
  },
  {
    name: "/model",
    description: "Show current model info",
    handler: (_args, ctx) => {
      const model = ctx.config.model ?? "not set";
      const provider = ctx.config.provider ?? "not set";
      ctx.print(renderChatBlock({
        role: "system",
        label: "MODEL",
        content: `Provider: ${provider}\nModel: ${model}\nAgent: ${ctx.config.agentName ?? "SnsCoder"}`,
      }));
    },
  },
];

// ── Main chat loop ──

export async function runChatSession(config: ChatSessionConfig): Promise<void> {
  const messages: ChatMessage[] = [];
  const model = config.model ? `${config.provider ?? "??"}/${config.model}` : "defaults";
  const sessionStarted = Date.now();
  const statusState: StatusBarState = {
    model: config.model ?? "none",
    tokensUsed: config.tokensUsed ?? 0,
    sessionStarted,
    memoryHits: config.memoryHits ?? 0,
  };

  const updateStatus = (): void => {
    clearStatusBar();
    renderStatusBar(statusState);
  };
  // Print splash
  const splashInfo: SplashInfo = {
    model: config.model,
    provider: config.provider,
    cwd: cwd(),
    platform: platform(),
  };
  clearScreen();
  stdout.write(renderSplash(splashInfo) + "\n\n");
  updateStatus();
  const print = (text: string): void => {
    clearStatusBar();
    stdout.write(text + "\n");
    updateStatus();
  };

  const ctx: ChatContext = { messages, config, print };

  // Readline loop
  while (true) {
    const promptStr = chalk.cyan("you") + chalk.dim(" › ");
    let line: string;
    try {
      const rl = createInterface({ input: stdin, output: stdout });
      try {
        line = await rl.question(promptStr);
      } finally {
        rl.close();
      }
    } catch {
      // EOF / Ctrl+C
      print(chalk.dim("\n  Goodbye. 👋\n"));
      process.exit(0);
    }

    const trimmed = line.trim();
    if (trimmed === "") continue;

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      const [cmd, ...args] = trimmed.split(/\s+/);
      const command = BUILTIN_COMMANDS.find(c => c.name === cmd);
      if (command) {
        await command.handler(args, ctx);
        continue;
      }
      print(chalk.yellow(`  Unknown command: ${cmd}. Type /help for available commands.`));
      continue;
    }

    // User message
    const userMsg: ChatMessage = { role: "user", content: trimmed, timestamp: new Date() };
    messages.push(userMsg);
    statusState.tokensUsed += trimmed.split(/\s+/).length; // rough word count
    updateStatus();
    print(renderChatBlock({
      role: "user",
      content: trimmed,
      meta: formatTime(userMsg.timestamp),
    }));

    // Assistant response
    let response: string | null = null;
    if (config.onUserMessage) {
      // Show spinner while waiting
      const spinner = ora({
        text: chalk.dim("thinking..."),
        spinner: "dots",
        color: "cyan",
      }).start();

      try {
        response = await config.onUserMessage(trimmed);
      } catch (err) {
        spinner.fail(chalk.red("error"));
        const errMsg = err instanceof Error ? err.message : String(err);
        print(renderChatBlock({
          role: "error",
          label: "ERROR",
          content: errMsg,
        }));
        continue;
      }
      spinner.stop();
    }

    // Display response
    const reply = response ?? `echo: ${trimmed}`;
    const assistantMsg: ChatMessage = { role: "assistant", content: reply, timestamp: new Date() };
    messages.push(assistantMsg);
    statusState.tokensUsed += reply.split(/\s+/).length;
    statusState.memoryHits += 1;
    updateStatus();
    print(renderChatBlock({
      role: "assistant",
      content: reply,
      meta: `${formatTime(assistantMsg.timestamp)} │ ${config.agentName ?? "SnsCoder"}`,
    }));
    print(""); // spacing
  }
}

/**
 * Minimal chat session with echo fallback (no LLM connected).
 * Used when no onUserMessage handler is provided.
 */
export async function runEchoChat(config: Omit<ChatSessionConfig, "onUserMessage">): Promise<void> {
  return runChatSession({
    ...config,
    onUserMessage: async (msg: string) => `echo: ${msg}`,
  });
}
