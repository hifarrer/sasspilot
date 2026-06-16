import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { BacklinkType, Cost } from "@aisas/shared";

/** One directory record as scraped from a clakr detail page. */
export interface ScrapedDirectory {
  slug: string;
  name: string;
  domain: string;
  submissionUrl: string;
  domainRating: number | null;
  category: string | null;
  categoryRank: number | null;
  categorySize: number | null;
  cost: Cost;
  backlinkType: BacklinkType;
  editorsPick: boolean;
  knownFor: string | null;
  description: string | null;
  sourceUrl: string;
  lastVerifiedAt: string | null;
}

/** Read a stat tile by its label, e.g. statValue($, "Domain Rating") -> "91". */
function statValue($: CheerioAPI, label: string): string | null {
  let val: string | null = null;
  $(".stats .st").each((_, el) => {
    const span = $(el).find("span").text().trim().toLowerCase();
    if (span === label.toLowerCase()) {
      val = $(el).find("b").first().text().trim();
    }
  });
  return val;
}

function parseCost(s: string | null): Cost {
  const v = (s ?? "").toLowerCase();
  if (v.includes("freemium")) return "freemium";
  if (v.includes("paid")) return "paid";
  return "free";
}

function parseBacklink(s: string | null): BacklinkType {
  const v = (s ?? "").toLowerCase();
  if (v.includes("dofollow")) return "dofollow";
  if (v.includes("nofollow")) return "nofollow";
  return "none";
}

/**
 * Heuristic slug -> domain fallback (the `.dom` element is authoritative when present).
 * e.g. "producthunt-com" -> "producthunt.com", "reddit-com-r-startups" -> "reddit.com/r/startups".
 */
export function slugToDomain(slug: string): string {
  const m = slug.match(
    /^(.*?)-(com|io|net|org|co|dev|app|ai|so|xyz|me|gg|to|sh|tech|news|info|us|club)(-.*)?$/,
  );
  if (m) {
    const host = `${m[1]!.replace(/-/g, "")}.${m[2]}`;
    const path = m[3] ? m[3].replace(/-/g, "/") : "";
    return `${host}${path}`;
  }
  return slug.replace(/-/g, ".");
}

/**
 * Parse a clakr directory detail page. Returns null for category/index pages
 * (detected by the absence of the "Visit" link and Domain Rating tile).
 */
export function parseDirectoryPage(
  html: string,
  slug: string,
  sourceUrl: string,
): ScrapedDirectory | null {
  const $ = cheerio.load(html);

  const visit = $("a.visit").attr("href") ?? null;
  const drRaw = statValue($, "Domain Rating");
  if (!visit && drRaw === null) return null; // not a directory detail page

  // Name: last breadcrumb segment, fallback to the H1 minus the boilerplate prefix.
  let name = "";
  const crumbs = $(".crumbs").text();
  if (crumbs.includes("›")) {
    name = crumbs.split("›").pop()!.trim();
  }
  if (!name) {
    name = $("h1").first().text().replace(/^submit your startup to\s*/i, "").trim();
  }

  // ".dom" -> "producthunt.com · Launchpads & Startups" (after dropping the verified badge).
  const domEl = $(".dom").first().clone();
  domEl.find("span").remove();
  const domText = domEl.text().trim();
  const [domainPart, ...catParts] = domText.split("·");
  const domain = (domainPart ?? "").trim() || slugToDomain(slug);
  const category = catParts.join("·").trim() || null;

  // Category rank "#2/145" -> rank 2, size 145.
  let categoryRank: number | null = null;
  let categorySize: number | null = null;
  const rankRaw = statValue($, "Category rank");
  const rankMatch = rankRaw?.match(/#?(\d+)\s*\/\s*(\d+)/);
  if (rankMatch) {
    categoryRank = Number(rankMatch[1]);
    categorySize = Number(rankMatch[2]);
  }

  // "What it's known for: <b>X</b>." from the key-facts list.
  let knownFor: string | null = null;
  const factTexts = $(".keyfacts li")
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim());
  const knownForFact = factTexts.find((t) => /known for/i.test(t));
  if (knownForFact) {
    const m = knownForFact.match(/known for:\s*(.+?)\.?$/i);
    knownFor = m ? m[1]!.trim() : null;
  }
  const description = factTexts[0] ?? null;

  // "Last verified: June 12, 2026".
  let lastVerifiedAt: string | null = null;
  const verifiedMatch = $(".upd")
    .text()
    .match(/Last verified:\s*([A-Za-z]+ \d{1,2},\s*\d{4})/);
  if (verifiedMatch) {
    const d = new Date(verifiedMatch[1]!);
    if (!Number.isNaN(d.getTime())) lastVerifiedAt = d.toISOString();
  }

  const editorsPick = (statValue($, "Editor's pick") ?? "").toLowerCase().includes("top");
  const drNum = drRaw ? Number(drRaw) : NaN;

  return {
    slug,
    name: name || slug,
    domain,
    submissionUrl: visit || (domain ? `https://${domain}/` : `https://${slugToDomain(slug)}/`),
    domainRating: Number.isFinite(drNum) ? drNum : null,
    category,
    categoryRank,
    categorySize,
    cost: parseCost(statValue($, "Pricing")),
    backlinkType: parseBacklink(statValue($, "Link type")),
    editorsPick,
    knownFor,
    description,
    sourceUrl,
    lastVerifiedAt,
  };
}
