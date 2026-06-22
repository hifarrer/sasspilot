import { extractInPage, type RawField } from "@aisas/shared/extract-in-page";
import { type Browser, type BrowserContext, chromium } from "playwright";

export interface VerifyResult {
  ok: boolean;
  fields: number;
  blocker: "login" | "captcha" | null;
  error?: string;
}

const FILLABLE_TYPES = new Set([
  "text",
  "email",
  "url",
  "tel",
  "search",
  "number",
  "textarea",
]);

function countFillable(fields: RawField[]): number {
  return fields.filter((f) => {
    if (f.isPassword) return false;
    const t = (f.signals.type || "").toLowerCase();
    const tag = (f.signals.tagName || "").toLowerCase();
    return FILLABLE_TYPES.has(t) || tag === "textarea";
  }).length;
}

/**
 * Headless browser that loads a candidate URL and confirms a fillable form is
 * present. One context is reused across checks; pages are opened/closed per call.
 */
export function createVerifier() {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  async function ensure(): Promise<BrowserContext> {
    if (context) return context;
    const launchOpts = {
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
      ignoreDefaultArgs: ["--enable-automation"],
    };
    try {
      browser = await chromium.launch({ ...launchOpts, channel: "chrome" });
    } catch {
      browser = await chromium.launch(launchOpts);
    }
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // tsx/esbuild wraps named functions with __name(); define it so the
    // serialized page.evaluate(extractInPage) resolves ("__name is not defined").
    await context.addInitScript(() => {
      const g = globalThis as unknown as { __name?: (f: unknown) => unknown };
      g.__name ??= (f) => f;
    });
    return context;
  }

  return {
    async verify(url: string): Promise<VerifyResult> {
      let ctx: BrowserContext;
      try {
        ctx = await ensure();
      } catch (e) {
        return { ok: false, fields: 0, blocker: null, error: `browser: ${(e as Error).message}` };
      }
      const page = await ctx.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});

        if (/\/(login|signin|sign-in|sign_in|auth)(\b|\/|\?|#|$)/i.test(page.url())) {
          return { ok: false, fields: 0, blocker: "login" };
        }
        const hasCaptcha = await page
          .locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .cf-turnstile')
          .count()
          .catch(() => 0);

        const fields = await page.evaluate(extractInPage).catch(() => [] as RawField[]);
        const n = countFillable(fields);
        return { ok: n >= 1, fields: n, blocker: hasCaptcha > 0 ? "captcha" : null };
      } catch (e) {
        return { ok: false, fields: 0, blocker: null, error: (e as Error).message };
      } finally {
        await page.close().catch(() => {});
      }
    },

    /** Rendered HTML after JS runs — for homepages whose links aren't in static HTML. */
    async html(url: string): Promise<string | null> {
      let ctx: BrowserContext;
      try {
        ctx = await ensure();
      } catch {
        return null;
      }
      const page = await ctx.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
        return await page.content();
      } catch {
        return null;
      } finally {
        await page.close().catch(() => {});
      }
    },

    async close(): Promise<void> {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
      context = null;
      browser = null;
    },
  };
}

export type Verifier = ReturnType<typeof createVerifier>;
