import { motion, useReducedMotion } from "motion/react";

interface WordRevealProps {
  text: string;
  className?: string;
  accentWord?: string;
  delay?: number;
}

/**
 * Kinetic typography: headline words cascade in with a clip reveal.
 * The word matching `accentWord` renders in the accent color.
 * Static render under prefers-reduced-motion.
 */
export function WordReveal({ text, className = "", accentWord, delay = 0 }: WordRevealProps) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  return (
    <span className={className} aria-label={text} role="text">
      {words.map((word, i) => {
        const isAccent = accentWord !== undefined && word.replace(/[.,]/g, "") === accentWord;
        return (
          <motion.span
            key={`${word}-${i}`}
            aria-hidden="true"
            className="inline-block will-change-transform"
            initial={reduce ? false : { opacity: 0, y: "0.6em", rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{
              duration: 0.5,
              delay: delay + i * 0.055,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ clipPath: "inset(0 0 12% 0)" }}
          >
            <span
              className={
                isAccent
                  ? "text-[var(--color-accent)]"
                  : ""
              }
            >
              {word}
            </span>
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        );
      })}
    </span>
  );
}
