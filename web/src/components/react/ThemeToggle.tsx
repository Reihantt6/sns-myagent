import { motion, useReducedMotion } from "motion/react";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sns-theme";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light/dark toggle. Persists to localStorage and sets `data-theme` on <html>. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const reduce = useReducedMotion();

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
    // Update the browser chrome hint (theme-color meta).
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#09090b" : "#fafafa";
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] text-[var(--color-fg-2)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
    >
      <motion.span
        key={theme}
        initial={reduce ? false : { rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="flex items-center justify-center"
      >
        {isDark ? <MoonIcon size={20} weight="fill" /> : <SunIcon size={20} weight="fill" />}
      </motion.span>
    </button>
  );
}
