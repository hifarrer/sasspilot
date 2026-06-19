import type { Locator, Page } from "playwright";
import { detectLoginWall, hasSuccessText, hasValidationErrors } from "./detect";
import type { SubmitOutcome } from "./types";

const SUBMIT_TEXT_RE =
  /\b(submit|add|post|publish|send|create|list|launch|register|continue|save)\b/i;
const SUBMIT_EXCLUDE_RE =
  /\b(cancel|back|reset|sign ?in|log ?in|sign ?up|google|github|facebook|twitter|apple|sso|search|filter|subscribe|newsletter|skip)\b/i;

export interface SubmitResult {
  outcome: Extract<SubmitOutcome, "submitted" | "rejected" | "pending">;
  postUrl: string;
  note?: string;
}

/** Keep only valid URLs — the submissions API rejects non-URL postUrl strings. */
function validUrl(u: string): string {
  try {
    new URL(u);
    return u;
  } catch {
    return "";
  }
}

async function usable(loc: Locator): Promise<boolean> {
  return (
    (await loc.count()) > 0 &&
    (await loc.isVisible().catch(() => false)) &&
    (await loc.isEnabled().catch(() => false))
  );
}

/** Find the form's submit control, preferring real submit inputs over text guesses. */
export async function locateSubmit(page: Page): Promise<Locator | null> {
  for (const sel of [
    'form button[type="submit"]',
    'form input[type="submit"]',
    'button[type="submit"]',
    'input[type="submit"]',
  ]) {
    const loc = page.locator(sel).first();
    if (await usable(loc)) {
      const text = `${await loc.innerText().catch(() => "")} ${(await loc.getAttribute("value").catch(() => "")) ?? ""}`;
      if (!SUBMIT_EXCLUDE_RE.test(text)) return loc;
    }
  }

  const buttons = page.getByRole("button");
  const n = await buttons.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const text = await b.innerText().catch(() => "");
    if (SUBMIT_TEXT_RE.test(text) && !SUBMIT_EXCLUDE_RE.test(text) && (await usable(b))) {
      return b;
    }
  }
  return null;
}

/**
 * Click submit and classify the result. Conservative: only claims `submitted`
 * on a positive signal (success text or navigation), never on silence.
 */
export async function clickSubmitAndDetect(page: Page, timeoutMs: number): Promise<SubmitResult> {
  const submit = await locateSubmit(page);
  if (!submit) {
    return { outcome: "pending", postUrl: validUrl(page.url()), note: "no submit control found" };
  }

  const before = page.url();
  let clickNote = "";
  try {
    await submit.click({ timeout: 15_000 });
  } catch (e) {
    // A navigation can tear down the execution context mid-click — not fatal; detect below.
    clickNote = `click: ${(e as Error).message}`;
  }

  await Promise.race([
    page.waitForURL((u) => u.toString() !== before, { timeout: timeoutMs }).catch(() => {}),
    page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {}),
  ]);
  await page.waitForTimeout(1200);

  const note = (base: string) => (clickNote ? `${base}; ${clickNote}` : base);

  if (await detectLoginWall(page)) {
    return { outcome: "pending", postUrl: validUrl(page.url()), note: note("login wall after submit") };
  }
  if (await hasSuccessText(page)) {
    return { outcome: "submitted", postUrl: validUrl(page.url()), note: note("success text") };
  }
  if (await hasValidationErrors(page)) {
    return { outcome: "rejected", postUrl: validUrl(page.url()), note: note("validation errors") };
  }
  if (page.url() !== before) {
    return { outcome: "submitted", postUrl: validUrl(page.url()), note: note("navigated after submit") };
  }
  return { outcome: "pending", postUrl: validUrl(page.url()), note: note("no clear success/failure signal") };
}
