# SNS-MyAgent Website (`web/`)

Landing page + docs site for SNS-MyAgent, deployed at **https://sns-myagent.web.id**
via Cloudflare Pages.

## Stack

- [Astro](https://astro.build) 5 (static output) + TypeScript
- Dark terminal / AI-agent design system (CSS tokens in `src/styles/global.css`)
- Docs content is **synced from the repo's `docs/` folder** at build time — the
  repo docs are the single source of truth.

## Develop

```bash
bun install
bun run dev          # predev runs sync:docs automatically
```

## Build

```bash
bun run build        # prebuild runs sync:docs, output in dist/
bun run preview      # serve the built dist/ locally
```

`sync:docs` (`node scripts/sync-docs.mjs`) copies `../docs/*.md` into the Astro
content collection, injects `title` frontmatter from each doc's H1, rewrites
relative links (doc-to-doc → `/docs/slug/`, screenshots → `/screenshots/`), and
copies `docs/screenshots/*` into `public/screenshots/`.

## Deploy to Cloudflare Pages (sns-myagent.web.id)

1. Create a Pages project from this repo (build command `cd web && bun run build`,
   output directory `web/dist`, or set root to `web`).
2. Environment: none required — the site is fully static.
3. Custom domain: add `sns-myagent.web.id` (and `www.sns-myagent.web.id` if
   wanted) under **Custom domains**, then follow the DNS setup Cloudflare shows
   (CNAME `sns-myagent.web.id` → your `<project>.pages.dev` hostname).

The repo already ships:

- `public/_headers` — security headers (nosniff, frame denial, referrer policy) + immutable caching for screenshots and hashed assets
- `public/_redirects` — SPA-ish redirects and `/docs` → `/docs/` fixups
- `public/favicon.svg` — site icon

## Structure

```
web/
├── astro.config.mjs          # site URL, trailingSlash, remark heading IDs, Shiki theme
├── scripts/
│   ├── sync-docs.mjs         # docs/screenshots sync (prebuild/predev)
│   └── remark-heading-ids.mjs# heading anchors for doc pages
├── public/                   # _headers, _redirects, favicon, screenshots (synced)
└── src/
    ├── content/config.ts     # docs content collection
    ├── data/docs-nav.ts      # sidebar groups/order
    ├── data/features.ts      # feature cards on the landing page
    ├── layouts/Base.astro    # base shell (head, fonts, nav toggle)
    ├── components/           # Nav, Footer
    ├── styles/               # global.css (tokens), landing.css, docs.css
    ├── utils/slug.ts         # heading slug helpers
    └── pages/
        ├── index.astro       # landing page
        ├── 404.astro
        └── docs/
            ├── index.astro   # docs hub
            └── [slug].astro  # doc pages (sidebar + prev/next)
```
