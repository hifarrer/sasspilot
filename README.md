# SAASregistry

Submit your startup to 1,000+ directories without filling the same form a thousand times.

Two things in one monorepo:

1. **A curated directory catalog** — ~1,057 startup-submission sites (seeded from [clakr.com](https://www.clakr.com/)) with Ahrefs Domain Rating, category, cost, and backlink type. Browse, filter, and track your submissions (accounts + CRM).
2. **A Chrome extension** — pre-fills each site's submission form from one startup profile by mapping fields to a canonical schema. Generate your tagline + descriptions from a URL with Claude. **A human always reviews and submits — nothing is auto-submitted.**

> The hard part of autofill is that most sites gate the form behind login, so a pre-discovery crawler can't reach every form. The extension therefore uses a **runtime heuristic field classifier** as the universal mechanism, with **curated per-site field maps** as an enhancement for high-value sites.

---

## Repository layout

```
packages/
  shared/            # canonical field keys + the heuristic classifier + zod schemas + types
                     # (the single source of truth, reused everywhere)
apps/
  web/               # Next.js (App Router): catalog UI + API + Prisma + Auth.js + AI endpoint
tools/
  scraper/           # clakr extraction -> data/directories.json
  field-discovery/   # Playwright form-field mapper -> data/field-maps/*.json
packages/
  extension/         # Manifest V3 extension (Vite + CRXJS + React)
data/
  directories.json   # scraped catalog (1,057 entries)
  field-maps/         # discovered/curated per-site selector maps
```

The **`@aisas/shared` classifier** is imported by the extension (runtime fill), the web app, and the discovery tool — classification logic lives in exactly one place. See [packages/shared/src/classifier.ts](packages/shared/src/classifier.ts).

---

## Prerequisites

- Node 20+ and pnpm (`corepack enable` then `corepack prepare pnpm@latest --activate`, or `npm i -g pnpm`)
- For field discovery: `pnpm --filter @aisas/field-discovery exec playwright install chromium`

## Setup

```bash
pnpm install
cp .env.example apps/web/.env.local      # then fill in secrets (see below)

# database (SQLite locally — zero setup)
pnpm --filter @aisas/web exec prisma db push
pnpm --filter @aisas/web run db:seed       # loads data/directories.json (run the scraper first if it's empty)

pnpm web                                   # http://localhost:3000
```

### Environment variables (`apps/web/.env.local`)

| Var | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | always | `file:./dev.db` for SQLite; a Postgres URL in prod |
| `AUTH_SECRET` | accounts | `npx auth secret` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | sign-in | or the Google pair; sign-in degrades gracefully if unset |
| `ANTHROPIC_API_KEY` | AI descriptions | the AI endpoint returns 503 until set |
| `AI_MODEL` | optional | default `claude-sonnet-4-6`; `claude-opus-4-8` selectable |

---

## The web app

- **`/directories`** — filter by category / cost / min-DR / backlink, search, paginate.
- **`/directories/[slug]`** — metadata, instructions, and a "Visit & submit" link.
- **`/dashboard`** — sign in, manage startup profiles, track submissions (pending → submitted → published), and mint an **extension token**.
- **API**: `GET /api/directories`, `POST /api/ai/generate-description`, `/api/profiles`, `/api/submissions`, `/api/field-maps`, `/api/tokens`. Mutating + AI routes accept either a web session or an `Authorization: Bearer <token>` (used by the extension).

## The Chrome extension

```bash
pnpm --filter @aisas/extension build      # -> packages/extension/dist
```

1. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked** → select `packages/extension/dist`.
2. Click the extension → **⚙ Settings** → set the app URL (`http://localhost:3000`) and paste a token from **Dashboard → Extension token** → **Sync profiles**.
3. On any submission page, click **Fill this page**. The extension uses a curated field map for that domain if one exists, otherwise classifies the fields heuristically. Filled fields are outlined blue; fields it isn't sure about are outlined amber and left for you. **Review, then submit yourself.**
4. **Generate with AI**: paste your site URL → Claude writes a tagline + short/long descriptions from the page.

## The clakr scraper

```bash
pnpm --filter @aisas/scraper start          # full crawl (polite: low concurrency, on-disk cache)
pnpm --filter @aisas/scraper run dry         # first 12 only, for a quick check
```

Writes `data/directories.json` + `data/meta.json`. Re-run `db:seed` to load changes. The scraper caches pages under `tools/scraper/.cache/` so re-runs are cheap. Domain Rating is treated as the objective Ahrefs fact it is; throttle politely.

## Field discovery (Playwright)

```bash
pnpm --filter @aisas/field-discovery exec tsx src/index.ts --url https://example.com/submit --slug example-com --domain example.com
```

Extracts the page's fields, classifies them with the shared classifier, and writes a **draft** map to `data/field-maps/{slug}.json` for human review (login-gated pages are flagged `requiresLogin`). Import reviewed maps with:

```bash
pnpm --filter @aisas/web exec tsx prisma/seed-fieldmaps.ts
```

---

## Testing

```bash
pnpm -r test          # shared classifier (vitest) + extension autofill (jsdom)
pnpm -r typecheck
```

## Deploy

- **Web**: Vercel. Switch `apps/web/prisma/schema.prisma` `provider` to `postgresql`, point `DATABASE_URL` at Neon/Supabase, set the env vars, run `prisma migrate deploy`.
- **Extension**: `pnpm --filter @aisas/extension build`, then zip `packages/extension/dist` for the Chrome Web Store. Point its settings at your deployed app URL.

## Ethos

Built for **human-reviewed** submissions — it pre-fills and highlights, never clicks submit. Directory metadata includes objective Ahrefs Domain Rating; descriptions are intended to be your own (or AI-drafted from your site), not copied.
