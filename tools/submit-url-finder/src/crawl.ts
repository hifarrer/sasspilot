import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { type Candidate, absolute, scoreLink } from "./heuristics";

const UA = "SAASregistry/0.1 (research; polite crawler)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, attempts = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20_000);
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml" },
        redirect: "follow",
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(400 * 2 ** i + Math.random() * 400);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function fetchWithCache(url: string, cachePath: string, refresh: boolean): Promise<string> {
  if (!refresh && existsSync(cachePath)) return readFile(cachePath, "utf8");
  const body = await fetchWithRetry(url);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, body, "utf8");
  await sleep(200 + Math.random() * 200); // polite gap between live fetches
  return body;
}

export interface CrawlResult {
  candidates: Candidate[];
  /** Deduped same-domain links (href + text) for the AI adjudicator. */
  links: { href: string; text: string }[];
  /** Trimmed visible page text for the AI adjudicator. */
  pageText: string;
}

/** Parse already-fetched HTML for submit candidates + AI context. */
export function parseHomepage(html: string, baseUrl: string, domain: string): CrawlResult {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const links: { href: string; text: string }[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim().slice(0, 120);
    const url = absolute(href, baseUrl);
    if (!url) return;

    if (!seen.has(url)) {
      seen.add(url);
      if (links.length < 80) links.push({ href: url, text });
    }

    const score = scoreLink(url, text, domain);
    if (score > 0) candidates.push({ url, text, score, source: "crawl", formConfirmed: false });
  });

  // Best score per URL wins.
  const byUrl = new Map<string, Candidate>();
  for (const c of candidates) {
    const prev = byUrl.get(c.url);
    if (!prev || c.score > prev.score) byUrl.set(c.url, c);
  }

  const pageText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
  return {
    candidates: [...byUrl.values()].sort((a, b) => b.score - a.score),
    links,
    pageText,
  };
}

/** Fetch (cached) and parse a directory's homepage for submission candidates. */
export async function crawlHomepage(
  homepageUrl: string,
  domain: string,
  cacheDir: string,
  slug: string,
  refresh: boolean,
): Promise<CrawlResult | null> {
  const cachePath = path.join(cacheDir, `${slug}.html`);
  let html: string;
  try {
    html = await fetchWithCache(homepageUrl, cachePath, refresh);
  } catch {
    return null;
  }
  return parseHomepage(html, homepageUrl, domain);
}
