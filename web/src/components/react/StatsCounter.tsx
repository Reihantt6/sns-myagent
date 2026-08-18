import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface Stat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

const STATS: Stat[] = [
  { value: 30, label: "built-in tools" },
  { value: 62, label: "slash commands" },
  { value: 16, label: "capability areas" },
  { value: 120, suffix: " MB", label: "single binary" },
];

function Stat({ value, prefix = "", suffix = "", label }: Stat) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5 text-center sm:gap-2">
      <span className="font-mono text-[30px] font-bold leading-none tracking-tight text-[var(--color-fg)] tabular-nums sm:text-[38px]">
        {prefix}
        {display}
        <span className="text-[var(--color-accent)]">{suffix}</span>
      </span>
      <span className="text-[12.5px] font-medium text-[var(--color-fg-3)] sm:text-[13px]">
        {label}
      </span>
    </div>
  );
}

/** Count-up stat band, animates once when scrolled into view. */
export function StatsCounter() {
  return (
    <div className="border-y border-[var(--color-line)] bg-[var(--color-ink-2)]">
      <div className="container-site grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:grid-cols-4 sm:py-12">
        {STATS.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}
