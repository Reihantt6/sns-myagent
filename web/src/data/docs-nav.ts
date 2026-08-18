/**
 * Sidebar organization for the docs site. Keys are doc slugs (filename minus
 * `.md`); the order within each group defines the sidebar order. Docs not
 * listed here still render and appear under "Other".
 */
export interface DocsGroup {
  label: string;
  slugs: string[];
}

export const DOCS_GROUPS: DocsGroup[] = [
  {
    label: "Getting Started",
    slugs: ["installation", "termux", "configuration", "faq", "troubleshooting"],
  },
  {
    label: "Core",
    slugs: ["terminal-ui", "architecture", "compaction", "plan-mode", "development"],
  },
  {
    label: "Memory & Context",
    slugs: ["memory", "tbm"],
  },
  {
    label: "Integrations",
    slugs: ["telegram", "mcp", "browser", "cron"],
  },
  {
    label: "Autonomy",
    slugs: ["goals", "subagents", "advisor"],
  },
  {
    label: "Extending",
    slugs: ["extensibility", "collab"],
  },
  {
    label: "Security & Lineage",
    slugs: ["security-model", "upstream", "syarat-ketentuan"],
  },
];
