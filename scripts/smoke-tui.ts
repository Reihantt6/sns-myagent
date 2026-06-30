/**
 * Visual smoke test for the SNS-MyAgent TUI rebrand.
 * Renders all 7 branded components and prints their ANSI output.
 * Run: /root/.bun/bin/bun run scripts/smoke-tui.ts
 *
 * ANSI codes are EXPECTED — they render as colors in a real terminal.
 * Don't strip them; the user sees them on their Mac.
 */
import { renderSplash, renderInlineHeader } from "../src/tui/splash.js";
import { renderChatBlock, renderSessionHeader } from "../src/tui/chat-blocks.js";
import { CHAT_COMMANDS, renderCommandPalette } from "../src/tui/command-palette.js";
import { renderErrorDisplay } from "../src/ui/error-display.js";
import { renderMemoryToast, renderMemoryRecall } from "../src/ui/memory-toast.js";
import {
  brand,
  accentGrad,
  subtle,
  gradientLine,
  labeledGradientLine,
  roleGradient,
  statusGradient,
} from "../src/ui/gradient.js";

// Stub stdout.columns so width-dependent renderers behave deterministically.
Object.defineProperty(process.stdout, "columns", { value: 100, configurable: true });

const sessionStart = Date.now() - 10_000; // 10s ago

function section(title: string) {
  console.log(`\n\x1b[1m\x1b[36m─── ${title} ───\x1b[0m`);
}

section("1. SPLASH");
console.log(
  renderSplash({
    model: "gpt-4o-mini",
    provider: "openai",
    cwd: "/root/sns-myagent",
    platform: "darwin-arm64",
    nodeVersion: "v22",
  }),
);

section("1b. INLINE HEADER");
console.log(
  renderInlineHeader({ model: "gpt-4o-mini", provider: "openai" }),
);

section("2. CHAT BLOCKS");
console.log(
  renderChatBlock({ role: "user", content: "halo, design barunya udah jadi?", meta: "10:23" }),
);
console.log();
console.log(
  renderChatBlock({
    role: "assistant",
    content: "Sudah! Aku SnsAgent — premium gradient TUI dengan splash, chat blocks, status bar, command palette, error display, memory toast. Semua branded SNS-MyAgent.",
    meta: "10:23",
  }),
);
console.log();
console.log(
  renderChatBlock({
    role: "tool",
    label: "TOOL  LS",
    content: "$ ls -la src/tui\ntotal 12\ndrwxr-xr-x .  src/tui/",
    meta: "12 files",
  }),
);

section("3. SESSION HEADER");
console.log(renderSessionHeader("openai/gpt-4o-mini", "0.3.4"));

section("4. COMMAND PALETTE");
console.log(
  renderCommandPalette({ commands: CHAT_COMMANDS, query: "mod", highlighted: 3 }),
);

section("5. ERROR DISPLAY");
console.log(
  renderErrorDisplay({
    severity: "error",
    title: "API key not configured",
    message: "OPENAI_API_KEY is missing. Set it in .env or via /init.",
    code: "AUTH_001",
    suggestion: "Run `snsagent init` to create .sns-myagent/config.json with your key.",
  }),
);

section("6. MEMORY TOAST");
console.log(
  renderMemoryToast({
    type: "recall",
    message: "preferences: dark theme",
    relevance: 0.85,
  }),
);
console.log(
  renderMemoryRecall("dark theme", "user prefers dark theme for terminal UI", 0.92),
);

section("7. GRADIENT HELPERS");
console.log("brand:        ", brand("SnsAgent — premium CLI"));
console.log("accentGrad:   ", accentGrad("accent gradient text"));
console.log("subtle:       ", subtle("subtle gradient"));
console.log("gradientLine: ", gradientLine(60));
console.log("labeledLine:  ", labeledGradientLine("VERIFIED", 60));
console.log("roleGradient: ", roleGradient("assistant")("assistant message border"));
console.log("statusGradient(success):", statusGradient("success")("✓ ok"));
console.log("statusGradient(warning):", statusGradient("warning")("⚠ warning"));
console.log("statusGradient(error):  ", statusGradient("error")("✗ failed"));
console.log("statusGradient(info):   ", statusGradient("info")("ℹ info"));

console.log("\n\x1b[1m\x1b[32m✓ All 7 TUI components rendered without crashing.\x1b[0m");
