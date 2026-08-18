// @ts-check
import { defineConfig } from "astro/config";
import { remarkHeadingIds } from "./scripts/remark-heading-ids.mjs";

// Static site — Cloudflare Pages serves the `dist/` output directly.
export default defineConfig({
  site: "https://sns-myagent.web.id",
  output: "static",
  trailingSlash: "always",
  markdown: {
    remarkPlugins: [remarkHeadingIds],
    shikiConfig: {
      // Terminal-ish dark theme for code blocks
      theme: "github-dark",
      wrap: true,
    },
  },
});
