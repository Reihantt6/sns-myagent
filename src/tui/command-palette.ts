/**
 * Command palette component for SNS-MyAgent terminal UI.
 *
 * Fuzzy-searchable command overlay with gradient styling.
 * Triggered by Ctrl+P or typing "/" in the input.
 */
import chalk from "chalk";
import gradient from "gradient-string";
import { BRAND_GRADIENT, ACCENT_GRADIENT } from "../ui/colors.js";

export interface PaletteCommand {
  /** Command name (e.g., "/help"). */
  name: string;
  /** Short description. */
  description: string;
  /** Category for grouping. */
  category: string;
  /** Keyboard shortcut (optional). */
  shortcut?: string;
  /** Whether command is enabled. */
  enabled?: boolean;
}

export interface CommandPaletteOptions {
  /** Available commands. */
  commands: PaletteCommand[];
  /** Search query filter. */
  query?: string;
  /** Currently highlighted index. */
  highlighted?: number;
  /** Width of the palette. */
  width?: number;
}

// ── Pre-built command lists ──

export const CHAT_COMMANDS: PaletteCommand[] = [
  { name: "/help", description: "Show available commands", category: "General", shortcut: "?" },
  { name: "/clear", description: "Clear screen", category: "General", shortcut: "⌘K" },
  { name: "/exit", description: "Quit the chat", category: "General", shortcut: "⌘Q" },
  { name: "/model", description: "Show/switch model", category: "Config" },
  { name: "/history", description: "Show conversation history", category: "General" },
  { name: "/memory", description: "Recall from memory", category: "Memory" },
  { name: "/skills", description: "List available skills", category: "Extensibility" },
  { name: "/plugins", description: "List installed plugins", category: "Extensibility" },
  { name: "/mcp", description: "MCP server management", category: "Extensibility" },
  { name: "/theme", description: "Change terminal theme", category: "Config" },
  { name: "/bench", description: "Run benchmarks", category: "Debug" },
  { name: "/debug", description: "Debug info", category: "Debug" },
];

// ── Fuzzy match ──

function fuzzyMatch(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact prefix match — highest score
  if (t.startsWith(q)) return 1;

  // Subsequence match
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive; // bonus for consecutive chars
    } else {
      consecutive = 0;
    }
  }

  return qi === q.length ? score / (q.length * q.length) : 0;
}

// ── Renderer ──

/**
 * Render the command palette as a bordered overlay.
 */
export function renderCommandPalette(opts: CommandPaletteOptions): string {
  const cols = process.stdout.columns ?? 80;
  const width = Math.min(opts.width ?? cols - 4, 64);
  const grad = gradient(BRAND_GRADIENT);
  const accentGrad = gradient(ACCENT_GRADIENT);

  // Filter and score commands
  const query = opts.query ?? "";
  const scored = opts.commands
    .map(cmd => ({
      cmd,
      score: fuzzyMatch(query, cmd.name) + fuzzyMatch(query, cmd.description) * 0.5,
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const highlighted = opts.highlighted ?? 0;

  // Group by category
  const groups = new Map<string, typeof scored>();
  for (const item of scored) {
    const cat = item.cmd.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  const lines: string[] = [];
  const inner = width - 4;

  // ── Header ──
  const searchIcon = "🔍";
  const headerText = `${searchIcon} ${accentGrad("Command Palette")}`;
  const fill = "─".repeat(Math.max(0, inner - 22));
  lines.push(grad("╭─") + headerText + grad(fill + "─╮"));

  // ── Search bar ──
  const searchDisplay = query ? chalk.white(query) + chalk.dim("█") : chalk.dim("Type to search...");
  const searchFill = " ".repeat(Math.max(0, inner - searchDisplay.length + 8));
  lines.push(grad("│") + `  ${searchDisplay}${searchFill}` + grad("│"));

  // ── Separator ──
  lines.push(grad("├") + "─".repeat(inner) + grad("┤"));

  // ── Commands ──
  let globalIdx = 0;
  for (const [category, items] of groups) {
    // Category header
    const catText = chalk.dim(` ${category.toUpperCase()} `);
    const catFill = " ".repeat(Math.max(0, inner - category.length - 2));
    lines.push(grad("│") + catText + catFill + grad("│"));

    for (const { cmd } of items) {
      const isSelected = globalIdx === highlighted;
      const nameStr = isSelected
        ? chalk.bgCyan.black(` ${cmd.name} `)
        : chalk.cyan(cmd.name);
      const descStr = chalk.dim(cmd.description);
      const shortcutStr = cmd.shortcut ? chalk.dim(` [${cmd.shortcut}]`) : "";

      const line = `  ${nameStr}  ${descStr}${shortcutStr}`;
      const padding = " ".repeat(Math.max(0, inner - visibleLen(line) + 4));

      if (isSelected) {
        lines.push(grad("│") + chalk.bgHex("#1a1a2e")(line) + padding + grad("│"));
      } else {
        lines.push(grad("│") + line + padding + grad("│"));
      }

      globalIdx++;
    }
  }

  // ── Footer ──
  const footer = chalk.dim(" ↑↓ navigate  ⏎ select  esc close ");
  const footerFill = " ".repeat(Math.max(0, inner - footer.length + 4));
  lines.push(grad("├") + "─".repeat(inner) + grad("┤"));
  lines.push(grad("│") + footer + footerFill + grad("│"));
  lines.push(grad("╰") + "─".repeat(inner) + grad("╯"));

  return lines.join("\n");
}

/**
 * Get filtered commands for a query.
 */
export function filterCommands(
  commands: PaletteCommand[],
  query: string,
): PaletteCommand[] {
  return commands
    .map(cmd => ({
      cmd,
      score: fuzzyMatch(query, cmd.name) + fuzzyMatch(query, cmd.description) * 0.5,
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.cmd);
}

// ── Helpers ──

function visibleLen(str: string): number {
  // Strip ANSI escape sequences for length calculation
  return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}
