import type { BrowserContext } from "playwright";
import { type LoginTarget, openContext } from "./browser";

/** A live headed browser whose sessions are saved to disk when `close()` runs. */
export interface LoginSession {
  context: BrowserContext;
  close(): Promise<void>;
}

/**
 * Caller-driven login (no stdin): open a headed persistent context with one tab per
 * target so the user can sign into each. The caller decides when to `close()`, which
 * flushes cookies to the on-disk profile for reuse on later runs.
 */
export async function openLoginSession(targets: LoginTarget[]): Promise<LoginSession> {
  const context = await openContext({ headed: true });
  for (const [i, t] of targets.entries()) {
    const page = i === 0 ? (context.pages()[0] ?? (await context.newPage())) : await context.newPage();
    try {
      await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    } catch {
      // best-effort — the user can navigate manually in the opened tab
    }
  }
  return { context, close: () => context.close() };
}
