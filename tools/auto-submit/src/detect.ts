import type { Page } from "playwright";
import type { Blocker } from "./types";

const LOGIN_URL_RE = /\/(login|signin|sign-in|sign_in|auth|account\/login|users\/sign_in)(\b|\/|\?|#|$)/i;
const SUCCESS_RE =
  /\b(thank you|thanks for|we received|received your|successfully|submission received|we'?ll review|pending review|under review|in the queue|added to|we got it|awaiting (approval|review))\b/i;

/** Any element matching `selector` that is actually visible. */
async function anyVisible(page: Page, selector: string): Promise<boolean> {
  const loc = page.locator(selector);
  const n = await loc.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    if (await loc.nth(i).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function exists(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count().catch(() => 0)) > 0;
}

async function bodyText(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).toLowerCase();
}

/** Looking at a login wall rather than the submission form? */
export async function detectLoginWall(page: Page): Promise<boolean> {
  if (LOGIN_URL_RE.test(page.url())) return true;
  return anyVisible(page, 'input[type="password"]');
}

/** A CAPTCHA widget is present (we never try to solve or bypass it). */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const selectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="turnstile"]',
    'iframe[src*="challenges.cloudflare"]',
    'iframe[title*="recaptcha" i]',
    'iframe[title*="captcha" i]',
    ".g-recaptcha",
    ".h-captcha",
    ".cf-turnstile",
    "[data-hcaptcha-widget-id]",
    "[data-sitekey]",
  ];
  for (const sel of selectors) if (await exists(page, sel)) return true;
  return false;
}

/** A payment / paywall stands between us and submitting. */
export async function detectPayment(page: Page): Promise<boolean> {
  if (
    await exists(
      page,
      'iframe[src*="stripe"], iframe[name*="stripe" i], iframe[src*="paypal"], iframe[src*="checkout"]',
    )
  ) {
    return true;
  }
  const text = await bodyText(page);
  return /(credit card number|card number|billing address|payment required|upgrade to submit|proceed to checkout|enter your card)/.test(
    text,
  );
}

/** Login → CAPTCHA → payment, in priority order. */
export async function detectBlocker(page: Page): Promise<Blocker | null> {
  if (await detectLoginWall(page)) return "login";
  if (await detectCaptcha(page)) return "captcha";
  if (await detectPayment(page)) return "payment";
  return null;
}

/** Visible validation/error messaging (after a submit attempt). */
export async function hasValidationErrors(page: Page): Promise<boolean> {
  return anyVisible(
    page,
    '[aria-invalid="true"], .error, .invalid-feedback, .field-error, .form-error, [role="alert"]',
  );
}

/** Success / "thanks, we'll review" messaging on the page. */
export async function hasSuccessText(page: Page): Promise<boolean> {
  const text = await page.locator("body").innerText().catch(() => "");
  return SUCCESS_RE.test(text);
}
