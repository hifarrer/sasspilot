import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { adjudicate, isAiConfigured } from "./adjudicate";
import { crawlHomepage, parseHomepage } from "./crawl";
import {
  type Candidate,
  type Confidence,
  type DirRecord,
  type Method,
  type SubmitUrlEntry,
  bandForScore,
  isManual,
} from "./heuristics";
import { probePaths } from "./probe";
import { type Verifier, createVerifier } from "./verify";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const CACHE_DIR = path.resolve(__dirname, "../.cache/pages");
const DIRECTORIES_FILE = path.join(DATA_DIR, "directories.json");
const OUT_FILE = path.join(DATA_DIR, "submit-urls.json");
const META_FILE = path.join(DATA_DIR, "submit-urls.meta.json");

const CONCURRENCY = 4;

// ---- CLI flags ----------------------------------------------------------
const args = process.argv.slice(2);
const flagValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const LIMIT = flagValue("--limit") ? Number(flagValue("--limit")) : Infinity;
const REFRESH = args.includes("--refresh");
const NO_VERIFY = args.includes("--no-verify");
const OPUS = args.includes("--opus");
const ONLY = (flagValue("--only") ?? "")
  .split(/[,\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const homepageOf = (dir: DirRecord): string =>
  dir.submissionUrl?.startsWith("http") ? dir.submissionUrl : `https://${dir.domain}/`;

function manualEntry(homepageUrl: string, reason: string): SubmitUrlEntry {
  return {
    submitUrl: homepageUrl,
    homepageUrl,
    confidence: "manual",
    method: "manual",
    verified: false,
    isManual: true,
    reason,
    checkedAt: new Date().toISOString(),
  };
}

/** Run the tiered discovery pipeline for a single directory. */
async function resolveOne(dir: DirRecord, verifier: Verifier | null): Promise<SubmitUrlEntry> {
  const homepageUrl = homepageOf(dir);
  const now = () => new Date().toISOString();

  if (isManual(dir)) return manualEntry(homepageUrl, "community/platform — submit manually");

  // Tier A + B in parallel.
  const [crawl, probeHits] = await Promise.all([
    crawlHomepage(homepageUrl, dir.domain, CACHE_DIR, dir.slug, REFRESH),
    probePaths(dir.domain),
  ]);
  let crawlCands = crawl?.candidates ?? [];
  let links = crawl?.links ?? [];
  let pageText = crawl?.pageText ?? "";

  // JS-heavy homepages (e.g. Product Hunt) have no links in static HTML — render
  // with the browser and re-extract before falling back to a blind AI guess.
  if (crawlCands.length === 0 && verifier) {
    const rendered = await verifier.html(homepageUrl);
    if (rendered) {
      const rc = parseHomepage(rendered, homepageUrl, dir.domain);
      crawlCands = rc.candidates;
      if (rc.links.length) links = rc.links;
      if (rc.pageText) pageText = rc.pageText;
    }
  }

  const all: Candidate[] = [...probeHits, ...crawlCands].sort((a, b) => b.score - a.score);

  let chosen: Candidate | null = null;
  let method: Method = "none";
  let confidence: Confidence = "unknown";
  let reason: string | null = null;

  const probeForm = probeHits.find((c) => c.formConfirmed);
  const topCrawl = crawlCands[0];
  const closeRivals =
    crawlCands.length >= 2 && crawlCands[0]!.score - crawlCands[1]!.score <= 1 && crawlCands[0]!.score < 6;

  if (probeForm) {
    chosen = probeForm;
    method = "probe";
    confidence = "high";
  } else if (topCrawl && topCrawl.score >= 4 && !closeRivals) {
    chosen = topCrawl;
    method = "crawl";
    confidence = bandForScore(topCrawl.score);
  } else if (isAiConfigured()) {
    // Tier C: ambiguous (no candidate, or close rivals) — let Claude decide.
    const pick = await adjudicate({
      name: dir.name,
      domain: dir.domain,
      homepageUrl,
      links,
      candidates: all,
      pageText,
      opus: OPUS,
    });
    if (pick) {
      reason = pick.reason || null;
      if (pick.isManual) return manualEntry(homepageUrl, reason ?? "no self-serve submission page");
      if (/^https?:\/\//i.test(pick.submitUrl)) {
        chosen = { url: pick.submitUrl, text: "(ai)", score: 5, source: "crawl", formConfirmed: false };
        method = "ai";
        confidence = pick.confidence;
      }
    }
  }

  // Fallback: take the best weak candidate rather than giving up outright.
  if (!chosen && all[0] && all[0].score >= 2) {
    chosen = all[0];
    method = all[0].source;
    confidence = "low";
  }

  if (!chosen) {
    return {
      submitUrl: homepageUrl,
      homepageUrl,
      confidence: "unknown",
      method: "none",
      verified: false,
      isManual: false,
      reason: reason ?? "no submission page found",
      checkedAt: now(),
    };
  }

  // Tier D: verify the chosen URL actually shows a fillable form. A login/CAPTCHA
  // wall isn't a failure — it corroborates that a gated submission form lives there.
  let verified = false;
  if (verifier) {
    const r = await verifier.verify(chosen.url);
    verified = r.ok;
    let gated = r.blocker !== null;
    if (!verified && !gated) {
      const runner = all.find((c) => c.url !== chosen!.url && c.score >= 2);
      if (runner) {
        const r2 = await verifier.verify(runner.url);
        if (r2.ok || r2.blocker !== null) {
          chosen = runner;
          method = runner.source;
          verified = r2.ok;
          gated = !r2.ok;
        }
      }
    }
    if (verified) {
      if (confidence === "low" || confidence === "unknown") confidence = "medium";
    } else if (gated) {
      if (confidence === "low" || confidence === "unknown") confidence = "medium";
      reason ??= "submission form is behind login/CAPTCHA";
    } else {
      confidence = "low";
      reason ??= "chosen URL did not show a fillable form";
    }
  }

  return {
    submitUrl: chosen.url,
    homepageUrl,
    confidence,
    method,
    verified,
    isManual: false,
    reason,
    checkedAt: now(),
  };
}

const GOOD: Confidence[] = ["high", "medium", "manual"];

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  const directories = JSON.parse(await readFile(DIRECTORIES_FILE, "utf8")) as DirRecord[];
  const existing: Record<string, SubmitUrlEntry> = existsSync(OUT_FILE)
    ? JSON.parse(await readFile(OUT_FILE, "utf8"))
    : {};

  // Decide the work list (scope + resume).
  let work = directories;
  if (ONLY.length) {
    const set = new Set(ONLY);
    work = directories.filter((d) => set.has(d.slug));
  } else if (!REFRESH) {
    work = directories.filter((d) => !(existing[d.slug] && GOOD.includes(existing[d.slug]!.confidence)));
  }
  if (Number.isFinite(LIMIT)) work = work.slice(0, LIMIT);

  console.log(
    `submit-url-finder: ${work.length} to process (catalog ${directories.length}, resolved ${Object.keys(existing).length}).`,
  );
  console.log(`  AI: ${isAiConfigured() ? (OPUS ? "opus" : "sonnet") : "OFF (no ANTHROPIC_API_KEY)"} | verify: ${NO_VERIFY ? "off" : "on"}`);
  if (!work.length) {
    console.log("Nothing to do. Use --refresh or --only <slug> to re-resolve.");
    return;
  }

  const verifier = NO_VERIFY ? null : createVerifier();
  const out: Record<string, SubmitUrlEntry> = { ...existing };
  const limit = pLimit(CONCURRENCY);
  let done = 0;

  const flush = () => writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");

  try {
    await Promise.all(
      work.map((dir) =>
        limit(async () => {
          try {
            out[dir.slug] = await resolveOne(dir, verifier);
          } catch (err) {
            out[dir.slug] = {
              submitUrl: homepageOf(dir),
              homepageUrl: homepageOf(dir),
              confidence: "unknown",
              method: "none",
              verified: false,
              isManual: false,
              reason: `error: ${(err as Error).message}`,
              checkedAt: new Date().toISOString(),
            };
          } finally {
            done++;
            if (done % 25 === 0) {
              await flush();
              console.log(`  ${done}/${work.length} resolved…`);
            }
          }
        }),
      ),
    );
  } finally {
    await verifier?.close();
    await flush();
  }

  // Meta summary over the full output.
  const entries = Object.values(out);
  const tally = (key: (e: SubmitUrlEntry) => string) =>
    entries.reduce<Record<string, number>>((acc, e) => {
      const k = key(e);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const failures = Object.entries(out)
    .filter(([, e]) => !e.isManual && (e.confidence === "unknown" || e.confidence === "low"))
    .map(([slug]) => slug);

  await writeFile(
    META_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        catalogTotal: directories.length,
        resolved: entries.length,
        byMethod: tally((e) => e.method),
        byConfidence: tally((e) => e.confidence),
        verified: entries.filter((e) => e.verified).length,
        needsAttention: failures.length,
        failures: failures.slice(0, 200),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `\n✅ ${entries.length} entries -> data/submit-urls.json (${entries.filter((e) => e.verified).length} verified, ${failures.length} need attention)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
