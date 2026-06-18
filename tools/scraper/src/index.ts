import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { parseDirectoryPage, type ScrapedDirectory } from "./parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CACHE_DIR = path.resolve(__dirname, "../.cache/pages");
const SITEMAP_CACHE = path.resolve(__dirname, "../.cache/sitemap-en.xml");
const DATA_DIR = path.join(REPO_ROOT, "data");

const SITEMAP_URL = "https://www.clakr.com/sitemap-en.xml";
const UA = "SAASregistry/0.1 (research; polite crawler)";
const CONCURRENCY = 4;
const DELAY_MS = 250;

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? Number(args[limitIdx + 1]) : Infinity;
const REFRESH = args.includes("--refresh");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, attempts = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(500 * 2 ** i + Math.random() * 500);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function fetchWithCache(url: string, cachePath: string): Promise<string> {
  if (!REFRESH && existsSync(cachePath)) return readFile(cachePath, "utf8");
  const body = await fetchWithRetry(url);
  await writeFile(cachePath, body, "utf8");
  await sleep(DELAY_MS + Math.random() * DELAY_MS); // be polite between live fetches
  return body;
}

function extractDirectorySlugs(xml: string): string[] {
  const slugs = new Set<string>();
  const re = /<loc>\s*https?:\/\/www\.clakr\.com\/directories\/([^<\/\s]+)\s*<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) slugs.add(decodeURIComponent(m[1]!));
  return [...slugs];
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  console.log("Fetching sitemap…");
  const xml = await fetchWithCache(SITEMAP_URL, SITEMAP_CACHE);
  let slugs = extractDirectorySlugs(xml);
  console.log(`Found ${slugs.length} /directories/* URLs.`);
  if (Number.isFinite(LIMIT)) {
    slugs = slugs.slice(0, LIMIT);
    console.log(`(--limit) processing first ${slugs.length}.`);
  }

  const limit = pLimit(CONCURRENCY);
  const results: ScrapedDirectory[] = [];
  let done = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    slugs.map((slug) =>
      limit(async () => {
        const url = `https://www.clakr.com/directories/${slug}`;
        const cachePath = path.join(CACHE_DIR, `${slug}.html`);
        try {
          const html = await fetchWithCache(url, cachePath);
          const rec = parseDirectoryPage(html, slug, url);
          if (rec) results.push(rec);
          else skipped++;
        } catch (err) {
          failed++;
          console.warn(`  ✗ ${slug}: ${(err as Error).message}`);
        } finally {
          done++;
          if (done % 50 === 0) {
            console.log(
              `  ${done}/${slugs.length} — kept ${results.length}, skipped ${skipped}, failed ${failed}`,
            );
          }
        }
      }),
    ),
  );

  results.sort(
    (a, b) => (b.domainRating ?? -1) - (a.domainRating ?? -1) || a.name.localeCompare(b.name),
  );

  const categories = [...new Set(results.map((r) => r.category).filter(Boolean))].sort() as string[];

  await writeFile(
    path.join(DATA_DIR, "directories.json"),
    JSON.stringify(results, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(DATA_DIR, "meta.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: results.length,
        skipped,
        failed,
        categories,
        source: "clakr.com",
        note: "Domain Rating sourced from Ahrefs (objective). Descriptions to be regenerated.",
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `\n✅ ${results.length} directories -> data/directories.json (skipped ${skipped}, failed ${failed}, ${categories.length} categories)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
