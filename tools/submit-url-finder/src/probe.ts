import * as cheerio from "cheerio";
import { COMMON_PATHS, type Candidate } from "./heuristics";

const UA = "SAASregistry/0.1 (research; polite crawler)";

/** A static <form> with at least one text-like input is a strong signal. */
function hasFillableForm(html: string): boolean {
  const $ = cheerio.load(html);
  const sel =
    'form input[type="text"], form input[type="email"], form input[type="url"], form input[type="search"], form input:not([type]), form textarea';
  return $(sel).length > 0;
}

async function getOk(url: string): Promise<{ ok: boolean; html: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, html: "" };
    // A redirect to the homepage/login means the path doesn't really exist.
    const finalPath = new URL(res.url).pathname.replace(/\/$/, "");
    if (finalPath === "" || /login|signin|sign-in/.test(res.url)) return { ok: false, html: "" };
    return { ok: true, html: await res.text() };
  } catch {
    return { ok: false, html: "" };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Probe well-known submission paths on `domain`. Sequential + early-exit on the
 * first form-confirmed hit to stay polite. Static fetch won't see JS-rendered
 * forms, so a 2xx without a form is still returned as a weaker candidate (the
 * Playwright verify step is the real check).
 */
export async function probePaths(domain: string): Promise<Candidate[]> {
  const hits: Candidate[] = [];
  for (const p of COMMON_PATHS) {
    const url = `https://${domain}${p}`;
    const { ok, html } = await getOk(url);
    if (!ok) continue;
    const form = hasFillableForm(html);
    hits.push({
      url,
      text: "(probe)",
      score: form ? 8 : 4,
      source: "probe",
      formConfirmed: form,
    });
    if (form) break; // strong enough — stop hammering the host
    if (hits.length >= 3) break;
  }
  return hits.sort((a, b) => b.score - a.score);
}
