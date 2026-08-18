/**
 * Sidebar organization for the docs site. Keys are doc slugs (filename minus
 * `.md`); the order within each group defines the sidebar order. Docs not
 * listed here still render and appear under "Other".
 *
 * Each group has an English label and a Bahasa Indonesia label.
 */
export interface DocsGroup {
  label: string;
  labelId: string;
  slugs: string[];
}

export const DOCS_GROUPS: DocsGroup[] = [
  {
    label: "Getting Started",
    labelId: "Memulai",
    slugs: ["installation", "termux", "configuration", "faq", "troubleshooting"],
  },
  {
    label: "Core",
    labelId: "Inti",
    slugs: ["terminal-ui", "architecture", "compaction", "plan-mode", "development"],
  },
  {
    label: "Memory & Context",
    labelId: "Memori & Konteks",
    slugs: ["memory", "tbm"],
  },
  {
    label: "Integrations",
    labelId: "Integrasi",
    slugs: ["telegram", "mcp", "browser", "cron"],
  },
  {
    label: "Autonomy",
    labelId: "Otonomi",
    slugs: ["goals", "subagents", "advisor"],
  },
  {
    label: "Extending",
    labelId: "Ekstensi",
    slugs: ["extensibility", "collab"],
  },
  {
    label: "Security & Lineage",
    labelId: "Keamanan & Lini",
    slugs: ["security-model", "upstream", "syarat-ketentuan"],
  },
];

/** Flattened doc order (for prev/next navigation). */
export const FLAT_ORDER = DOCS_GROUPS.flatMap((g) => g.slugs);
