/**
 * Shared patterns, scoring, and classification for submit-URL discovery.
 *
 * The catalog's `submissionUrl` is almost always a homepage root (scraped from
 * Clakr). These helpers turn a homepage into ranked candidate submission pages
 * and decide which directories have no self-serve form at all (communities).
 */

export type Confidence = "high" | "medium" | "low" | "manual" | "unknown";
export type Method = "crawl" | "probe" | "ai" | "manual" | "none";

/** One resolved entry, keyed by slug in data/submit-urls.json. */
export interface SubmitUrlEntry {
  submitUrl: string;
  homepageUrl: string;
  confidence: Confidence;
  method: Method;
  verified: boolean;
  isManual: boolean;
  reason: string | null;
  checkedAt: string;
}

/** A candidate submission page found by crawl or probe. */
export interface Candidate {
  url: string;
  text: string;
  score: number;
  source: "crawl" | "probe";
  formConfirmed: boolean;
}

/** The subset of a catalog Directory row this tool reads. */
export interface DirRecord {
  slug: string;
  name: string;
  domain: string;
  submissionUrl: string;
  category: string | null;
  cost: string;
}

// Link text that signals "submit your thing here".
export const SUBMIT_TEXT_RE =
  /\b(submit|add (your |a )?(product|startup|tool|listing|site|app|saas|project)|get listed|list (your|my)|suggest (a|your)?|post (a|your)|launch (your|here)|publish (your|a))\b/i;

// Href/path fragments that signal a submission page.
export const SUBMIT_HREF_RE =
  /(submit|add[-_]?(your[-_]?)?(product|startup|tool|listing|site|app|saas|project)|get[-_]?listed|suggest|products?\/new|\/new(\/|$|\?)|post[-_]?(a|your)|launch)/i;

// Strong endings — a path that IS the submit page, not just mentions it.
export const STRONG_PATH_RE =
  /\/(submit(-a-[a-z]+|[-_][a-z]+)?|products?\/new|add(-(product|startup|tool|listing|app))?|get-?listed|suggest|launch)\/?($|\?|#)/i;

// Auth / boilerplate / off-topic links we never want as the submit target.
export const EXCLUDE_RE =
  /(log[-_]?in|sign[-_]?in|sign[-_]?up|\/auth(\b|\/)|password|\/account|\/cart|checkout|pricing|\/blog|\/about|contact[-_]?us|\/privacy|\/terms|\/faq|\/help|careers|\/jobs|advertis|sponsor|newsletter|\/feed|\/rss|\/category|\/tag\/|\/author|facebook\.com|twitter\.com|x\.com\/|instagram\.com|youtube\.com|t\.me)/i;

// Common submission paths to probe directly, ordered by likelihood.
export const COMMON_PATHS = [
  "/submit",
  "/submit-a-startup",
  "/submit-startup",
  "/submit-a-tool",
  "/submit-tool",
  "/submit-a-product",
  "/products/new",
  "/product/new",
  "/new",
  "/add",
  "/add-product",
  "/add-startup",
  "/add-tool",
  "/get-listed",
  "/suggest",
  "/launch",
];

// Hosts that are communities/platforms with no self-serve "submit a listing"
// form — submission means joining/posting manually or via a developer account.
const MANUAL_HOST_RE =
  /(^|\.)(linkedin\.com|reddit\.com|github\.com|t\.me|telegram\.org|facebook\.com|twitter\.com|x\.com|discord\.(com|gg)|medium\.com|chromewebstore\.google\.com|apps\.apple\.com|play\.google\.com|addons\.mozilla\.org|news\.ycombinator\.com)$/i;

const MANUAL_CATEGORIES = new Set(["Communities", "Reddit"]);

/** A directory with no automatable submission form (community / platform). */
export function isManual(dir: DirRecord): boolean {
  if (dir.category && MANUAL_CATEGORIES.has(dir.category)) return true;
  if (MANUAL_HOST_RE.test(dir.domain)) return true;
  return false;
}

/** Resolve `href` against `base` to an absolute http(s) URL, or null to skip. */
export function absolute(href: string, base: string): string | null {
  const h = href.trim();
  if (!h || h.startsWith("#") || /^(mailto:|tel:|javascript:|data:)/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** True if `url`'s host is `domain`, `www.domain`, or a subdomain of it. */
export function sameHost(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const d = domain.toLowerCase();
    return host === d || host === `www.${d}` || host.endsWith(`.${d}`);
  } catch {
    return false;
  }
}

/**
 * Score a crawled link as a submission-page candidate. Returns <= 0 to discard.
 * Higher = more likely the real submit page.
 */
export function scoreLink(url: string, text: string, domain: string): number {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    return -1;
  }
  const hay = `${path} ${text}`.toLowerCase();
  if (EXCLUDE_RE.test(url) || EXCLUDE_RE.test(text)) return -1;

  let score = 0;
  if (SUBMIT_HREF_RE.test(path)) score += 3;
  if (SUBMIT_TEXT_RE.test(text)) score += 3;
  if (STRONG_PATH_RE.test(path)) score += 3;
  if (sameHost(url, domain)) score += 1;
  else score -= 4; // off-domain "submit" links are almost always wrong
  // A shorter, dedicated path beats a deep marketing page mentioning "submit".
  if (path.split("/").filter(Boolean).length <= 2 && SUBMIT_HREF_RE.test(path)) score += 1;
  void hay;
  return score;
}

/** Map a numeric crawl/probe score to a confidence band. */
export function bandForScore(score: number): Confidence {
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}
