import { extractInPage, type RawField } from "@aisas/shared/extract-in-page";
import type { Page } from "playwright";

export type { RawField };

/**
 * Read every fillable field on the current page. Runs the shared `extractInPage`
 * in the page context (the same reader tools/field-discovery uses).
 */
export async function readFields(page: Page): Promise<RawField[]> {
  return page.evaluate(extractInPage);
}
