# @aisas/submit-url-finder

Resolves the **real submission page** for every directory in `data/directories.json`.

The Clakr-scraped `submissionUrl` is almost always a homepage root
(`https://www.producthunt.com/`), not the page where you actually add a product
(`/products/new`). The auto-submit pipeline lands on the homepage, finds no form,
and submits nothing. This tool discovers the true submit URL per directory and
writes a sidecar `data/submit-urls.json` — it never modifies `directories.json`.

## How it works (tiered, escalates only when needed)

1. **Classify** — communities/platforms (LinkedIn, Reddit, GitHub, Chrome Web
   Store, App/Play stores…) have no self-serve form → marked `manual`, no crawl/AI.
2. **Crawl** — fetch the homepage (cached), score `<a>` links that look like
   submit pages.
3. **Probe** — request common paths (`/submit`, `/products/new`, `/add-product`…)
   and check for a static form.
4. **AI adjudication** — only for ambiguous cases, Claude picks the best URL via
   forced tool use (needs `ANTHROPIC_API_KEY`; mirrors `apps/web/lib/anthropic.ts`).
5. **Verify** — load the chosen URL headless (Playwright) and confirm a fillable
   form exists; falls back to a runner-up once if it doesn't.

## Usage

```bash
# small dry run (first 15 unresolved)
pnpm --filter @aisas/submit-url-finder dry

# full run over all ~1,057 directories
pnpm --filter @aisas/submit-url-finder start

# re-resolve specific slugs
pnpm --filter @aisas/submit-url-finder start --only producthunt-com,betalist-com

# typecheck
pnpm --filter @aisas/submit-url-finder typecheck
```

AI tier needs the key in the environment, e.g. (PowerShell):

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."; pnpm --filter @aisas/submit-url-finder dry
```

Without the key the tool still runs — it just skips the AI tier and relies on
crawl + probe + verify.

### Flags

| Flag | Effect |
|------|--------|
| `--limit N` | Process only the first N of the work list. |
| `--refresh` | Re-resolve everything (ignore already-good results, refetch homepages). |
| `--only a,b` | Resolve just these slugs (forces reprocessing). |
| `--no-verify` | Skip the Playwright verification step (faster, less trustworthy). |
| `--opus` | Use `claude-opus-4-8` for adjudication instead of Sonnet. |

## Output

- `data/submit-urls.json` — map of `slug → { submitUrl, homepageUrl, confidence,
  method, verified, isManual, reason, checkedAt }`.
- `data/submit-urls.meta.json` — distribution by method/confidence, verified
  count, and the list of slugs that need attention.

**Resume:** re-running skips slugs already resolved at `high`/`medium`/`manual`
confidence unless `--refresh` or `--only` is passed.

## Consuming the results

Wiring verified URLs into submissions is a deliberate **second step** (so we can
eyeball accuracy first). Two low-risk options:

- Overlay `submitUrl` onto `submissionUrl` for `verified` entries when seeding in
  `apps/web/prisma/seed.ts`.
- Push verified URLs into `AutoSubmitTarget.submitUrl` — the pipeline already
  prefers it (`target.submitUrl ?? directory.submissionUrl` in
  `tools/auto-submit/src/index.ts`).
