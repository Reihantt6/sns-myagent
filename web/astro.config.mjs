// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { remarkHeadingIds } from "./scripts/remark-heading-ids.mjs";
import { remarkCallouts } from "./scripts/remark-callouts.mjs";

// Static site - Cloudflare Pages serves the `dist/` output directly.
export default defineConfig({
  site: "https://sns-myagent.web.id",
  output: "static",
  trailingSlash: "always",
  integrations: [react()],
  vite: {
    // @ts-expect-error - @tailwindcss/vite returns Plugin<any>[]; Astro accepts it
    plugins: [tailwindcss()],
  },
  markdown: {
    remarkPlugins: [remarkHeadingIds, remarkCallouts],
    shikiConfig: {
      // Dual themes so code blocks follow light/dark mode.
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      wrap: true,
    },
  },
});
