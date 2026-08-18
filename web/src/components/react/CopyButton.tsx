import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

/** Copy-to-clipboard button with feedback. Min 44px touch target. */
export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable: no-op */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${text} to clipboard`}
      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--color-line-2)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-fg-2)] transition-colors duration-150 hover:border-[var(--color-accent-border)] hover:text-[var(--color-accent)]"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="flex items-center gap-1.5 text-[var(--color-accent)]"
          >
            <CheckIcon size={16} weight="bold" />
            Copied
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5"
          >
            <CopyIcon size={16} />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
