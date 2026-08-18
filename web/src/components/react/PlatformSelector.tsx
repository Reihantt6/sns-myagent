import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { ComponentType } from "react";
import {
  WindowsLogoIcon,
  LinuxLogoIcon,
  DeviceMobileIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { CopyButton } from "./CopyButton";

type PlatformId = "windows" | "unix" | "termux";

interface Platform {
  id: PlatformId;
  label: string;
  name: string;
  badge: string;
  icon: ComponentType<any>;
  command: string;
  note: string;
  docsHref: string;
  docsLabel: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "windows",
    label: "Windows",
    name: "Windows",
    badge: "PowerShell",
    icon: WindowsLogoIcon,
    command:
      "irm https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex",
    note: "Requires Node.js 18 or newer. Pass -UseBun to install through Bun instead.",
    docsHref: "/docs/installation/",
    docsLabel: "Windows install guide",
  },
  {
    id: "unix",
    label: "Linux / macOS / WSL",
    name: "Linux, macOS, and WSL",
    badge: "Shell",
    icon: LinuxLogoIcon,
    command:
      "curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash",
    note: "Installs to ~/.local/bin. Reload your shell or add it to PATH when finished.",
    docsHref: "/docs/installation/",
    docsLabel: "Linux / macOS install guide",
  },
  {
    id: "termux",
    label: "Termux",
    name: "Termux (Android)",
    badge: "Shell",
    icon: DeviceMobileIcon,
    command:
      "curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash",
    note: "Detects Termux and builds from source because the prebuilt binary does not run on Android.",
    docsHref: "/docs/termux/",
    docsLabel: "Termux install guide",
  },
];

/** Segmented platform switcher with animated command card and copy button. */
export function PlatformSelector() {
  const [activeId, setActiveId] = useState<PlatformId>("windows");
  const reduce = useReducedMotion();
  const active = PLATFORMS.find((p) => p.id === activeId) ?? PLATFORMS[0];
  const ActiveIcon = active.icon;

  return (
    <div>
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="Choose your platform"
        className="grid grid-cols-3 gap-1 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1"
      >
        {PLATFORMS.map((p) => {
          const selected = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`platform-tab-${p.id}`}
              aria-selected={selected}
              aria-controls="platform-panel"
              onClick={() => setActiveId(p.id)}
              className={`relative min-h-[44px] cursor-pointer rounded-[9px] px-2 text-[12px] font-semibold leading-tight transition-colors duration-150 sm:text-[13px] ${
                selected
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-fg-3)] hover:text-[var(--color-fg-2)]"
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="platform-pill"
                  transition={
                    reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }
                  }
                  className="absolute inset-0 rounded-[9px] border border-[var(--color-accent-border)] bg-[var(--color-surface)] shadow-sm"
                />
              )}
              <span className="relative z-10">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Command card */}
      <div
        id="platform-panel"
        role="tabpanel"
        aria-labelledby={`platform-tab-${activeId}`}
        className="mt-3 overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-fg)]">
                <ActiveIcon size={16} weight="fill" className="text-[var(--color-accent)]" />
                {active.name}
              </span>
              <span className="rounded-[6px] border border-[var(--color-line)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-fg-3)]">
                {active.badge}
              </span>
            </div>

            <div className="flex items-center gap-3 px-4 py-3">
              <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12.5px] text-[var(--color-fg)] sm:text-[13px]">
                {active.command}
              </code>
              <CopyButton text={active.command} label="Copy" />
            </div>

            <div className="flex flex-col gap-2.5 border-t border-[var(--color-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] leading-relaxed text-[var(--color-fg-3)]">{active.note}</p>
              <a
                href={active.docsHref}
                className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-deep)]"
              >
                {active.docsLabel}
                <ArrowRightIcon size={14} weight="bold" />
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
