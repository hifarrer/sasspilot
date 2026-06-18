import * as cheerio from "cheerio";

export interface PageText {
  title: string;
  description: string;
  text: string;
}

/** Fetch a landing page and extract title, meta description, and readable text. */
export async function fetchPageText(url: string): Promise<PageText> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "SAASregistry/0.1 (startup description generator)",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Could not fetch page (HTTP ${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, template").remove();

  const title =
    $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";
  const text = $("body").text().replace(/\s+/g, " ").trim();

  return { title, description, text };
}
