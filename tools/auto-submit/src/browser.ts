import { mkdir } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { type BrowserContext, chromium } from "playwright";
import { log } from "./log";
import { PROFILE_DIR } from "./paths";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Open the persistent Chromium context. The on-disk profile dir IS the session
 * store, so logins captured during `login` are reused on every later run.
 */
export async function openContext(opts: { headed: boolean }): Promise<BrowserContext> {
  await mkdir(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !opts.headed,
    viewport: { width: 1280, height: 900 },
    userAgent: USER_AGENT,
  });
  // tsx/esbuild wraps named functions with __name(); define it in every page so a
  // serialized page.evaluate(extractInPage) resolves it ("__name is not defined").
  await context.addInitScript(() => {
    const g = globalThis as unknown as { __name?: (f: unknown) => unknown };
    g.__name ??= (f) => f;
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
