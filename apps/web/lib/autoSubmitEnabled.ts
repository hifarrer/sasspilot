/**
 * The auto-submit dashboard tool drives Playwright IN-PROCESS, so it can only run on
 * the machine hosting the web app (the user's local machine) — never on the hosted
 * Railway deployment. It is enabled only when AUTOSUBMIT_ENABLED=true (set in
 * apps/web/.env locally, left unset in production). Routes check this FIRST, before any
 * dynamic import of the Playwright core, so production never loads Playwright.
 */
export function isAutoSubmitEnabled(): boolean {
  return process.env.AUTOSUBMIT_ENABLED === "true";
}
