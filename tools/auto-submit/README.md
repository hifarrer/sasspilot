# @aisas/auto-submit

A **local** Playwright runner that autonomously submits your startup to directory sites:
it opens each site's submission page in a browser profile you've already logged into,
reads the form, fills it from your startup profile, clicks submit, detects the outcome,
and records it back to the web app's submission tracker.

It runs on **your machine** because it reuses your real, logged-in browser sessions.
It talks to the web API over the same personal-access-token (PAT) flow the extension uses.

## How it works

```
resolve target → open submitUrl in your logged-in profile
  → detect login-wall / CAPTCHA / payment (skip + record if blocked)
  → read fields (curated field map first, else live extract + classify)
  → fill via Playwright → click submit → detect success/failure
  → screenshot → POST /api/submissions (submitted | rejected | pending)
```

Already-submitted directories (status `submitted`/`published` in the CRM) are skipped, so
re-runs are safe and idempotent.

## One-time setup

1. **Install** (from the repo root): `pnpm install`
2. **Mint a token**: in the web app, create a personal access token (Account → Tokens). It
   looks like `aisas_…`.
3. **Configure env** (repo-root `.env`, already gitignored):
   ```
   AUTOSUBMIT_API_BASE=http://localhost:3000   # or your deployed URL
   AUTOSUBMIT_TOKEN=aisas_xxxxxxxxxxxxxxxxxxxxx
   ```
4. **Pick targets**: copy `targets.example.json` → `targets.json` and list the directory
   slugs you want. Find slugs in the web app or `data/directories.json`.

## Log in to your target sites (once)

```
pnpm --filter @aisas/auto-submit login
```

This opens a **headed** browser and walks through each target URL, pausing so you can sign
in. Your sessions are saved to `tools/auto-submit/.profile/` and reused on every later run.
No passwords are stored by the tool — only the browser's own session cookies, on disk.

> `.profile/` holds live session cookies. It's gitignored; treat it as sensitive.

## Run

```
# Safe default: fill + screenshot, never submits, no CRM writes
pnpm --filter @aisas/auto-submit start run --dry-run --headed

# Go live: fill + click submit + record results
pnpm --filter @aisas/auto-submit start run --submit
```

### Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--dry-run` / `--submit` | `--dry-run` | Fill only vs actually click submit |
| `--targets <path>` | `./targets.json` | Target list file |
| `--slugs a,b,c` | — | Inline targets (overrides the file) |
| `--profile-id <id>` | first profile | Which startup profile to submit |
| `--limit <n>` | all | Cap how many sites this run |
| `--headed` | headless | Show the browser |
| `--allow-paid` | off | Also attempt `cost: paid` directories |
| `--no-require-all-fields` | required | Submit even if a required field couldn't be filled |
| `--timeout <ms>` | `45000` | Per-site navigation/wait timeout |
| `--record-dry-run` | off | Write CRM rows during a dry run too |

## Output

Each run writes `tools/auto-submit/.runs/<timestamp>/` (gitignored):

- `report.json` — per-site outcome, filled/skipped fields, submit status, errors
- `<slug>.png` — full-page screenshot of each site after the attempt

## Safety

- Sequential, with randomized human-like delays; one site's failure never aborts the run.
- CAPTCHAs are **detected and skipped, never bypassed**.
- Paid directories are skipped unless `--allow-paid`.
- By default a site is **not** submitted if a required field couldn't be filled.
