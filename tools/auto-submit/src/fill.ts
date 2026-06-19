import { rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Locator, Page } from "playwright";
import type { FieldOutcome } from "./types";

/** One field to fill: a stable selector + the resolved value. */
export interface FillTask {
  key: string;
  selector: string;
  value: string | null;
  inputType?: string;
  maxLength?: number | null;
  required?: boolean;
}

function extFromContentType(ct: string | null, url: string): string {
  const known: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  };
  const base = ct?.split(";")[0]?.trim().toLowerCase();
  if (base && known[base]) return known[base];
  const m = /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.exec(url);
  return m ? `.${m[1].toLowerCase()}` : ".png";
}

/** Download a remote image and attach it to a file input; never fatal. */
async function uploadFile(loc: Locator, url: string, key: string): Promise<FieldOutcome> {
  const base = { key, selector: "" };
  let tmp: string | null = null;
  try {
    const res = await fetch(url);
    if (!res.ok) return { key, selector: "", action: "skipped-fileupload", detail: `download ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    tmp = path.join(os.tmpdir(), `autosubmit-${key}-${Date.now()}${extFromContentType(res.headers.get("content-type"), url)}`);
    await writeFile(tmp, buf);
    await loc.setInputFiles(tmp);
    return { ...base, action: "filled", detail: "uploaded" };
  } catch (e) {
    return { ...base, action: "skipped-fileupload", detail: (e as Error).message };
  } finally {
    if (tmp) await rm(tmp, { force: true }).catch(() => {});
  }
}

/** Mirror the extension's fillSelect: exact label/value, else first includes() match. */
async function fillSelect(loc: Locator, value: string): Promise<FieldOutcome> {
  const base = { key: "", selector: "" };
  try {
    await loc.selectOption({ label: value });
    return { ...base, action: "filled" };
  } catch {
    // fall through to fuzzy matching
  }
  const options = await loc
    .locator("option")
    .evaluateAll((opts) =>
      (opts as HTMLOptionElement[]).map((o) => ({ value: o.value, text: o.textContent ?? "" })),
    )
    .catch(() => [] as Array<{ value: string; text: string }>);
  const v = value.toLowerCase();
  const match = options.find(
    (o) => o.text.toLowerCase().includes(v) || o.value.toLowerCase().includes(v),
  );
  if (!match) return { ...base, action: "skipped-unfillable", detail: "no matching option" };
  await loc.selectOption(match.value);
  return { ...base, action: "filled" };
}

/**
 * Fill one field with native Playwright actions. Returns an outcome rather than
 * throwing, so one bad field never aborts the site.
 */
export async function fillField(page: Page, task: FillTask): Promise<FieldOutcome> {
  const base = { key: task.key, selector: task.selector };
  if (task.value == null || task.value === "") return { ...base, action: "skipped-novalue" };

  try {
    const loc = page.locator(task.selector).first();
    if ((await loc.count()) === 0) return { ...base, action: "error", detail: "selector not found" };

    const tagName = await loc.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    const elType = (await loc.getAttribute("type").catch(() => null))?.toLowerCase() ?? "";

    // A real file input → upload (e.g. logo). A logo URL in a text field falls through.
    if (tagName === "input" && elType === "file") {
      const r = await uploadFile(loc, task.value, task.key);
      return { ...r, selector: task.selector };
    }

    if (!(await loc.isVisible().catch(() => false))) {
      return { ...base, action: "skipped-unfillable", detail: "not visible" };
    }

    if (tagName === "select") {
      const r = await fillSelect(loc, task.value);
      return { ...r, key: task.key, selector: task.selector };
    }

    if (!(await loc.isEditable().catch(() => false))) {
      return { ...base, action: "skipped-unfillable", detail: "not editable" };
    }

    const value =
      task.maxLength && task.maxLength > 0 ? task.value.slice(0, task.maxLength) : task.value;
    await loc.fill(value);
    return { ...base, action: "filled" };
  } catch (e) {
    return { ...base, action: "error", detail: (e as Error).message };
  }
}
