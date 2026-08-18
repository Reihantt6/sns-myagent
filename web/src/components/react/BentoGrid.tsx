import { motion, useReducedMotion } from "motion/react";
import {
  BrainIcon,
  GitBranchIcon,
  PlugsIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
  TreeStructureIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export interface BentoCell {
  title: string;
  desc: string;
  /** Icon name key, resolved inside the island (avoids component serialization across the boundary). */
  icon: BentoIconName;
  status?: "VERIFIED" | "PARTIAL";
  href?: string;
  shot?: string;
  shotAlt?: string;
  featured?: boolean;
}

export type BentoIconName =
  | "tree"
  | "wrench"
  | "brain"
  | "terminal"
  | "plugs"
  | "git"
  | "shield";

const ICONS: Record<BentoIconName, Icon> = {
  tree: TreeStructureIcon,
  wrench: WrenchIcon,
  brain: BrainIcon,
  terminal: TerminalWindowIcon,
  plugs: PlugsIcon,
  git: GitBranchIcon,
  shield: ShieldCheckIcon,
};

interface BentoGridProps {
  cells: BentoCell[];
}

const statusTone: Record<string, string> = {
  VERIFIED: "text-[var(--color-accent)]",
  PARTIAL: "text-[var(--color-warn)]",
};

/**
 * Asymmetric bento grid: varied cell sizes, 2-3 cells with real screenshots.
 * Icons are resolved by name inside the island so Phosphor components never
 * cross the Astro->React serialization boundary (they are objects, not
 * serializable values, and crash hydration when passed as props).
 */
export function BentoGrid({ cells }: BentoGridProps) {
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
      {cells.map((cell, i) => {
        const Icon = ICONS[cell.icon];
        return (
          <motion.a
            key={cell.title}
            href={cell.href ?? "/docs/architecture/"}
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.55, delay: (i % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
            whileHover={reduce ? undefined : { scale: 1.02, y: -3 }}
            className={`group relative flex flex-col overflow-hidden rounded-[16px] border border-[var(--color-line)] bg-[var(--color-surface)] p-7 transition-colors duration-200 hover:border-[var(--color-accent-border)] md:col-span-6 ${
              cell.featured ? "md:col-span-7" : ""
            }`}
          >
            {/* Subtle corner glow on hover */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent-border)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="mb-5 flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--color-line-2)] bg-[var(--color-ink-2)] text-[var(--color-accent)]">
                <Icon size={20} weight="duotone" />
              </span>
              {cell.status && (
                <span className={`text-[11px] font-bold uppercase tracking-[0.1em] ${statusTone[cell.status]}`}>
                  {cell.status}
                </span>
              )}
            </div>

            <h3 className="text-[17px] font-bold tracking-tight text-[var(--color-fg)]">{cell.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-fg-2)]">{cell.desc}</p>

            {cell.shot && (
              <div className="mt-6 overflow-hidden rounded-[10px] border border-[var(--color-line)]">
                <img
                  src={`/screenshots/${cell.shot}`}
                  alt={cell.shotAlt ?? cell.title}
                  loading="lazy"
                  className="w-full transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                />
              </div>
            )}
          </motion.a>
        );
      })}
    </div>
  );
}
