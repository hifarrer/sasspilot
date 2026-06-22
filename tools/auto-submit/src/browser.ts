import { mkdir } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { type BrowserContext, chromium } from "playwright";
import { log } from "./log";
import { PROFILE_DIR } from "./paths";

/**
 * Open the persistent Chromium context. The on-disk profile dir IS the session
 * store, so logins captured during `login` are reused on every later run.
 *
 * We make it look like a normal browser so sign-in flows — especially "Sign in with
 * Google", which refuses "automated" browsers with "This browser may not be secure" —
 * aren't blocked: use the real installed Chrome (channel), drop the --enable-automation
 * flag, disable the AutomationControlled blink feature, and hide navigator.webdriver.
 */
export async function openContext(opts: { headed: boolean }): Promise<BrowserContext> {
  await mkdir(PROFILE_DIR, { recursive: true });

  const launchOpts = {
    headless: !opts.headed,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  };

  let context: BrowserContext;
  try {
    // Real Chrome is far less likely to be flagged than bundled Chromium.
    context = await chromium.launchPersistentContext(PROFILE_DIR, { ...launchOpts, channel: "chrome" });
  } catch {
    // Chrome not installed — fall back to bundled Chromium (Google login may still block).
    context = await chromium.launchPersistentContext(PROFILE_DIR, launchOpts);
  }

  await context.addInitScript(() => {
    // tsx/esbuild wraps named functions with __name(); define it so a serialized
    // page.evaluate(extractInPage) resolves it ("__name is not defined").
    const g = globalThis as unknown as { __name?: (f: unknown) => unknown };
    g.__name ??= (f) => f;
    // Hide the automation marker some sign-in flows check.
    try {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    } catch {
      // some contexts disallow redefining; ignore
    }
  });
  return context;
}

export interface LoginTarget {
  slug: string;
  name: string;
  url: string;
}

/**
 * Headed walkthrough: open each target site and pause so the user signs in.
 * Cookies/sessions persist to the profile dir on close.
 */
export async function runLogin(targets: LoginTarget[]): Promise<void> {
  const context = await openContext({ headed: true });
  const rl = readline.createInterface({ input, output });
  try {
    const page = await context.newPage();
    log.info(
      `\nOpening ${targets.length} site(s). Sign in to each, then press Enter to advance.\n` +
        "Sessions are saved to the local browser profile and reused on later runs.\n",
    );
    for (const [i, t] of targets.entries()) {
      log.step(`(${i + 1}/${targets.length}) ${t.name} — ${t.url}`);
      try {
        await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      } catch (e) {
        log.warn(`Couldn't load automatically (${(e as Error).message}). Navigate manually if needed.`);
      }
      await rl.question("  → Sign in if needed, then press Enter… ");
    }
    log.ok("Sessions saved. You can now run the submitter.");
  } finally {
    rl.close();
    await context.close();
  }
}
