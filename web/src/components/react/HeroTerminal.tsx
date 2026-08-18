import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const LINES = [
  { ps1: "$", cmd: "snsagent", cls: "text-zinc-100" },
  { ps1: ">", cmd: "what files are in this directory?", cls: "text-zinc-100" },
  { ps1: "", cmd: "src/  cli/  config/  tools/  session/  tbm/  docs/", cls: "text-zinc-500" },
  { ps1: ">", cmd: "add MCP filesystem for /home/user/projects", cls: "text-zinc-100" },
  { ps1: "", cmd: "ok, mcp filesystem is live now.", cls: "text-[var(--color-accent)]" },
  { ps1: ">", cmd: "switch to anthropic, claude-sonnet", cls: "text-zinc-100" },
  { ps1: "", cmd: "model -> claude-sonnet-4-20250514 (anthropic)", cls: "text-zinc-500" },
  { ps1: ">", cmd: "/memory stats", cls: "text-zinc-100" },
  { ps1: "", cmd: "backend: mnemopi  facts: 214  auto-recall: on", cls: "text-zinc-500" },
];

const STATUSES = [
  "mcp filesystem: live",
  "memory auto-recall: on, 214 facts",
  "model: claude-sonnet-4 (anthropic)",
  "approval mode: always-ask",
];

/** Premium animated terminal window: lines cascade in, status ticks, cursor blinks. */
export function HeroTerminal() {
  const reduce = useReducedMotion();
  const [statusIdx, setStatusIdx] = useState(0);

  // Cycle the live status line on an interval (purposeful: shows the agent's
  // live runtime state). Static under prefers-reduced-motion.
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setStatusIdx((i) => (i + 1) % STATUSES.length), 2800);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-[16px] border border-[var(--color-line)] bg-[#0a0e15] shadow-[var(--shadow-pop)]"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[12px] font-medium tracking-tight text-[var(--color-fg-3)]">
          snsagent · ~/projects
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-[7px] px-5 py-5 font-mono text-[13px] leading-relaxed">
        {LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-baseline gap-2"
          >
            {line.ps1 && (
              <span className="shrink-0 select-none font-semibold text-[var(--color-accent)]">
                {line.ps1}
              </span>
            )}
            <span className={line.cls}>{line.cmd}</span>
          </motion.div>
        ))}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 + LINES.length * 0.16 + 0.2 }}
          className="flex items-center gap-2"
        >
          <span className="font-semibold text-[var(--color-accent)]">&gt;</span>
          <motion.span
            aria-hidden="true"
            animate={reduce ? undefined : { opacity: [1, 0, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block h-[14px] w-[7px] bg-[var(--color-accent)]"
          />
        </motion.div>
      </div>

      {/* Live status footer */}
      <div className="flex items-center gap-2.5 border-t border-white/10 bg-white/[0.02] px-5 py-3">
        <motion.span
          aria-hidden="true"
          animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="h-2 w-2 shrink-0 rounded-full bg-[#28c840]"
        />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          live
        </span>
        <span className="h-3 w-px bg-white/10" aria-hidden="true" />
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={statusIdx}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="block truncate font-mono text-[12px] text-zinc-400"
            >
              {STATUSES[statusIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
