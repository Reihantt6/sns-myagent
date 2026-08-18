#!/usr/bin/env node
/**
 * Sync the repo's `docs/` markdown into the Astro content collection and
 * `public/screenshots/` at build time.
 *
 * The repository's `docs/` folder is the single source of truth for product
 * documentation. Astro content collections require YAML frontmatter, so this
 * script:
 *   1. copies ../docs/*.md      -> src/content/docs/<slug>.md
 *   2. injects a `title` frontmatter derived from the first `# ` heading
 *   3. rewrites relative links so they resolve on the website
 *      - ./memory.md            -> /docs/memory/
 *      - ./memory.md#section    -> /docs/memory/#section
 *      - ./screenshots/x.png    -> /screenshots/x.png
 *      - ../docs/screenshots/x  -> /screenshots/x
 *      - ../README.md           -> /
 *      - ../AUDIT-REPORT.md     -> GitHub blob link
 *   4. copies ../docs/screenshots/* -> public/screenshots/
 *
 * Run via `bun run sync:docs` (wired into prebuild/predev).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "..");
const DOCS_SRC = path.join(repoRoot, "docs");
const DOCS_DST = path.join(webRoot, "src", "content", "docs");
const SHOTS_SRC = path.join(DOCS_SRC, "screenshots");
const SHOTS_DST = path.join(webRoot, "public", "screenshots");

const GITHUB_BLOB = "https://github.com/Reihantt6/sns-myagent/blob/main";

function escRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rewrite one relative link target (the part inside markdown parens). */
function rewriteLink(target) {
  const [pathPart, hashPart] = target.split("#", 2);
  const hash = hashPart !== undefined ? `#${hashPart}` : "";
  const clean = pathPart.trim();

  // Screenshot references
  if (/^\.?\.?\/(docs\/)?screenshots\//.test(clean) || /^screenshots\//.test(clean)) {
    const file = clean.split("/").pop();
    return `/screenshots/${file}${hash}`;
  }

  // Doc-to-doc links
  if (/\.md$/.test(clean)) {
    const bare = clean.replace(/^\.\.\//, "").replace(/^\.\//, "");
    if (/^docs\//.test(bare)) {
      const slug = bare.replace(/^docs\//, "").replace(/\.md$/, "");
      return `/docs/${slug}/${hash}`;
    }
    if (bare === "README.md") return `/${hash}`;
    // Root-level repo docs not hosted on the site -> GitHub
    return `${GITHUB_BLOB}/${bare}${hash}`;
  }

  // Anything else with a ../ prefix that we don't understand -> GitHub
  if (clean.startsWith("../")) {
    const bare = clean.replace(/^\.\.\//, "");
    return `${GITHUB_BLOB}/${bare}${hash}`;
  }

  return target;
}

/** Rewrite markdown links/images in a single doc. */
function rewriteMarkdownLinks(md) {
  return md.replace(
    /(\[[^\]]*\]\()([^)\s]+)(\s+"[^"]*")?(\))/g,
    (_whole, prefix, target, title, suffix) => {
      if (/^(https?:|mailto:|#|\/)/.test(target)) return _whole;
      return `${prefix}${rewriteLink(target)}${title ?? ""}${suffix}`;
    },
  );
}

/** Inject frontmatter with a title derived from the first `# ` heading. */
function withFrontmatter(raw, filename) {
  const titleMatch = /^#\s+(.+)$/m.exec(raw);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, "").replace(/-/g, " ");
  return `---\ntitle: ${JSON.stringify(title)}\n---\n\n${raw}`;
}

fs.rmSync(DOCS_DST, { recursive: true, force: true });
fs.mkdirSync(DOCS_DST, { recursive: true });

const files = fs.readdirSync(DOCS_SRC).filter((f) => f.endsWith(".md"));
let synced = 0;
for (const file of files) {
  const raw = fs.readFileSync(path.join(DOCS_SRC, file), "utf8");
  const rewritten = rewriteMarkdownLinks(raw);
  const withFm = withFrontmatter(rewritten, file);
  fs.writeFileSync(path.join(DOCS_DST, file), withFm, "utf8");
  synced++;
}

// Screenshots
let shots = 0;
if (fs.existsSync(SHOTS_SRC)) {
  fs.mkdirSync(SHOTS_DST, { recursive: true });
  for (const file of fs.readdirSync(SHOTS_SRC)) {
    if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(file)) continue;
    fs.copyFileSync(path.join(SHOTS_SRC, file), path.join(SHOTS_DST, file));
    shots++;
  }
}

console.log(`sync-docs: ${synced} docs -> src/content/docs/, ${shots} screenshots -> public/screenshots/`);
