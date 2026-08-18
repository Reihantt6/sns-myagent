import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface MobileNavProps {
  links: Array<{ href: string; label: string }>;
}

/** Self-contained mobile nav: hamburger trigger + spring drawer. md:hidden trigger. */
export function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();

  // The portal target (document.body) only exists in the browser. Astro
  // server-renders React islands during static generation, so gate the portal
  // until after the client mounts.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] text-[var(--color-fg-2)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] md:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
      >
        <ListIcon size={22} />
      </button>

      {/* Render the fixed overlay into <body> so the header's backdrop-filter
          (backdrop-blur-md) does not become its containing block. Otherwise the
          "fixed inset-y-0 right-0" drawer gets sized against the 64px header
          instead of the viewport and collapses into a broken sliver. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <motion.aside
                key="drawer"
                id="mobile-nav-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Site navigation"
                initial={reduce ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={reduce ? undefined : { x: "100%" }}
                transition={{ type: "spring", stiffness: 340, damping: 34 }}
                className="fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-[340px] flex-col bg-[var(--color-ink-2)] shadow-[var(--shadow-pop)]"
              >
                <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                  <span className="font-mono text-[15px] font-bold text-[var(--color-accent)]">&gt;_</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close navigation"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] text-[var(--color-fg-2)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
                  >
                    <XIcon size={22} />
                  </button>
                </div>
                <nav className="flex flex-1 flex-col gap-1 px-4 py-6" aria-label="Mobile">
                  {links.map((link, i) => (
                    <motion.a
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      initial={reduce ? false : { opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="flex min-h-[48px] items-center rounded-[10px] px-4 text-[15px] font-medium text-[var(--color-fg-2)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
                    >
                      {link.label}
                    </motion.a>
                  ))}
                </nav>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-line)] p-4">
                  <span className="text-[13px] font-medium text-[var(--color-fg-3)]">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="border-t border-[var(--color-line)] p-4">
                  <a
                    href="/docs/installation/"
                    onClick={() => setOpen(false)}
                    className="btn btn-primary w-full"
                  >
                    Install snsagent
                  </a>
                </div>
              </motion.aside>
            </>
          )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
