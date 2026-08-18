import type { Icon } from "@phosphor-icons/react";
import {
  TreeStructureIcon,
  WrenchIcon,
  TerminalWindowIcon,
  RobotIcon,
  BrainIcon,
  PaperPlaneTiltIcon,
  PlugsIcon,
  GitBranchIcon,
  CalculatorIcon,
  ClockIcon,
  CodeIcon,
  GlobeIcon,
  CrosshairIcon,
  StarIcon,
  ArrowsInLineVerticalIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";

export type FeatureStatus = "VERIFIED" | "PARTIAL";

export interface Feature {
  title: string;
  desc: string;
  icon: Icon;
  status: FeatureStatus;
  href?: string;
  shots?: string[];
}

export const FEATURES: Feature[] = [
  {
    title: "Configure it by talking to it",
    desc: "BYOK setup wizard plus conversation-driven configuration: ask to add an MCP filesystem, switch providers, or change models mid-conversation.",
    icon: TreeStructureIcon,
    status: "VERIFIED",
    shots: ["setup-wizard.png", "setup-glyphs.png", "main-tui.png"],
  },
  {
    title: "30 built-in tools",
    desc: "Read, write, edit, bash, web search, browser, SSH, eval runtimes, memory, MCP, todo, and more. All real implementations.",
    icon: WrenchIcon,
    status: "VERIFIED",
    href: "/docs/architecture/",
    shots: ["tools.png"],
  },
  {
    title: "62 slash commands",
    desc: "Everything from /settings and /model to /memory, /goal, /cron, /task, /mcp, /tbm, /compact and /browser.",
    icon: TerminalWindowIcon,
    status: "VERIFIED",
    href: "/docs/terminal-ui/",
    shots: ["help.png", "settings.png"],
  },
  {
    title: "Multi-provider LLM",
    desc: "OpenAI, Anthropic, Ollama, or any custom Base URL. Bring your own key, switch models mid-conversation.",
    icon: RobotIcon,
    status: "VERIFIED",
    href: "/docs/configuration/",
    shots: ["model.png"],
  },
  {
    title: "Memory that survives restarts",
    desc: "mnemopi local backend: retain, persist, semantically recall, and inject into model context. Per-project scoped.",
    icon: BrainIcon,
    status: "VERIFIED",
    href: "/docs/memory/",
    shots: ["memory-stats.png", "memory-diagnose.png"],
  },
  {
    title: "Telegram bot",
    desc: "Drive the agent from your phone. An opt-in numeric allowlist gates who can reach it.",
    icon: PaperPlaneTiltIcon,
    status: "PARTIAL",
    href: "/docs/telegram/",
  },
  {
    title: "MCP integration",
    desc: "Connect Model Context Protocol servers and use their tools and resources inside the agent.",
    icon: PlugsIcon,
    status: "PARTIAL",
    href: "/docs/mcp/",
  },
  {
    title: "Subagents & multi-agent",
    desc: "Delegate async tasks, consensus / critic / best-of-N agent patterns, budgeted execution.",
    icon: GitBranchIcon,
    status: "PARTIAL",
    href: "/docs/subagents/",
  },
  {
    title: "TBM token budget manager",
    desc: "Tombstoning, context pyramid, lazy skills, tool-output compression. Integrated into the turn lifecycle, default off.",
    icon: CalculatorIcon,
    status: "VERIFIED",
    href: "/docs/tbm/",
  },
  {
    title: "Cron scheduler",
    desc: "Scheduled prompt / shell / skill jobs that persist across restarts.",
    icon: ClockIcon,
    status: "PARTIAL",
    href: "/docs/cron/",
  },
  {
    title: "Eval runtimes",
    desc: "Python, JavaScript, Ruby, and Julia evaluation backends with sandboxing and resource limits.",
    icon: CodeIcon,
    status: "VERIFIED",
  },
  {
    title: "Browser automation",
    desc: "Puppeteer-based browsing: navigate, screenshot, extract, fill forms from inside a conversation.",
    icon: GlobeIcon,
    status: "PARTIAL",
    href: "/docs/browser/",
  },
  {
    title: "Plan mode & goals",
    desc: "Plan-before-execute workflows and autonomous objective mode with token budgets.",
    icon: CrosshairIcon,
    status: "PARTIAL",
    href: "/docs/plan-mode/",
  },
  {
    title: "Advisor review",
    desc: "A second model reviews turns for correctness before the agent commits to an answer.",
    icon: StarIcon,
    status: "VERIFIED",
    href: "/docs/advisor/",
  },
  {
    title: "Context compaction",
    desc: "Multiple compaction strategies keep long sessions inside the context window.",
    icon: ArrowsInLineVerticalIcon,
    status: "PARTIAL",
    href: "/docs/compaction/",
  },
  {
    title: "Safe by default",
    desc: "Approval mode defaults to always-ask; memory and TBM default to off. No forced subscription, ~120 MB binary.",
    icon: ShieldCheckIcon,
    status: "VERIFIED",
    href: "/docs/security-model/",
  },
];

export const SHOTS: Array<{ file: string; caption: string; cmd: string }> = [
  { file: "setup-wizard.png", caption: "Setup wizard, BYOK provider", cmd: "snsagent" },
  { file: "main-tui.png", caption: "Main TUI", cmd: "snsagent" },
  { file: "settings.png", caption: "Settings panel", cmd: "/settings" },
  { file: "model.png", caption: "Model picker", cmd: "/model" },
  { file: "memory-stats.png", caption: "Memory stats", cmd: "/memory stats" },
  { file: "memory-diagnose.png", caption: "Memory diagnose", cmd: "/memory diagnose" },
  { file: "mcp.png", caption: "MCP surface", cmd: "/mcp" },
  { file: "stats.png", caption: "Stats dashboard", cmd: "/stats" },
  { file: "goal.png", caption: "Active objective", cmd: "/goal" },
  { file: "cron.png", caption: "Scheduled jobs", cmd: "/cron list" },
  { file: "task.png", caption: "Async subagent jobs", cmd: "/task" },
  { file: "browser.png", caption: "Browser mode toggle", cmd: "/browser" },
  { file: "compact.png", caption: "Compaction check", cmd: "/compact" },
  { file: "telegram.png", caption: "Telegram status (sanitized)", cmd: "telegram status" },
  { file: "tools.png", caption: "Tools inspector", cmd: "/tools" },
  { file: "setup-glyphs.png", caption: "Setup-wizard glyphs", cmd: "snsagent" },
  { file: "tbm-dashboard.png", caption: "TBM dashboard", cmd: "/tbm" },
  { file: "help.png", caption: "Help shortcut list", cmd: "/help" },
  { file: "comm-mode.png", caption: "Collab comm-mode indicator", cmd: "/collab" },
  { file: "error-state.png", caption: "Error state, no model selected", cmd: "!" },
];
