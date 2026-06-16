import { classifyField, type FieldSignals, shouldFill } from "@aisas/shared/classifier";
import { type FieldMap, type StartupProfile, valueForKey } from "@aisas/shared/types";
import type { FillResult } from "../lib/messages";

type Fillable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export interface FillOptions {
  /** Skip the visibility filter (jsdom has no layout, so tests pass this). */
  includeHidden?: boolean;
}

const SKIP_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "password",
  "file",
  "checkbox",
  "radio",
  "range",
  "color",
]);

function isVisible(el: HTMLElement): boolean {
  const anyEl = el as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof anyEl.checkVisibility === "function") return anyEl.checkVisibility();
  return el.offsetParent !== null;
}

function escapeId(id: string): string {
  const cssNs = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  return cssNs?.escape ? cssNs.escape(id) : id.replace(/["\\]/g, "\\$&");
}

function getLabel(el: Element): string {
  const id = el.getAttribute("id");
  if (id) {
    const forLabel = document.querySelector(`label[for="${escapeId(id)}"]`);
    if (forLabel?.textContent) return forLabel.textContent;
  }
  const wrapping = el.closest("label");
  if (wrapping?.textContent) return wrapping.textContent;

  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const ref = document.getElementById(labelledby);
    if (ref?.textContent) return ref.textContent;
  }

  const prev = el.previousElementSibling;
  if (prev?.textContent && prev.textContent.trim().length > 0 && prev.textContent.length < 80) {
    if (/^(label|span|div|p|strong|b)$/i.test(prev.tagName)) return prev.textContent;
  }
  return "";
}

export function collectFields(opts: FillOptions = {}): Array<{ el: Fillable; signals: FieldSignals }> {
  const els = Array.from(document.querySelectorAll<Fillable>("input, textarea, select"));
  const out: Array<{ el: Fillable; signals: FieldSignals }> = [];

  for (const el of els) {
    if (el.disabled || (el as HTMLInputElement).readOnly) continue;
    if (!opts.includeHidden && !isVisible(el)) continue;

    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? (el as HTMLInputElement).type : tag;
    if (tag === "input" && SKIP_INPUT_TYPES.has(type)) continue;

    const maxLen = (el as HTMLInputElement).maxLength;
    out.push({
      el,
      signals: {
        label: getLabel(el).replace(/\s+/g, " ").trim(),
        name: el.getAttribute("name"),
        id: el.getAttribute("id"),
        placeholder: el.getAttribute("placeholder"),
        ariaLabel: el.getAttribute("aria-label"),
        autocomplete: el.getAttribute("autocomplete"),
        type,
        tagName: tag,
        maxLength: maxLen && maxLen > 0 ? maxLen : null,
      },
    });
  }
  return out;
}

/** Set a value the way React/Vue controlled inputs expect (native setter + events). */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const v = value.toLowerCase();
  const opt = Array.from(el.options).find(
    (o) => o.text.toLowerCase().includes(v) || o.value.toLowerCase().includes(v),
  );
  if (!opt) return false;
  el.value = opt.value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function applyValue(el: Element, value: string): boolean {
  if (el instanceof HTMLSelectElement) return fillSelect(el, value);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value);
    return true;
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    el.textContent = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  return false;
}

function highlight(el: HTMLElement, kind: "filled" | "ambiguous"): void {
  const prev = el.style.outline;
  el.style.outline = kind === "filled" ? "2px solid #4f6bed" : "2px dashed #fbbf24";
  el.style.outlineOffset = "1px";
  window.setTimeout(() => {
    el.style.outline = prev;
  }, 4000);
}

export function fillPage(
  profile: StartupProfile,
  fieldMap: FieldMap | null,
  opts: FillOptions = {},
): FillResult {
  const filled: FillResult["filled"] = [];
  const ambiguous: FillResult["ambiguous"] = [];
  let skipped = 0;

  // 1) Precise curated field map for this site, when available.
  if (fieldMap && fieldMap.fields.length > 0) {
    for (const entry of fieldMap.fields) {
      const el = document.querySelector<HTMLElement>(entry.selector);
      const value = entry.optionText ?? valueForKey(profile, entry.canonicalKey);
      if (el && value && applyValue(el, value)) {
        highlight(el, "filled");
        filled.push({ key: entry.canonicalKey, label: entry.selector });
      } else {
        skipped++;
      }
    }
    return { mode: "map", filled, ambiguous, skipped, total: fieldMap.fields.length };
  }

  // 2) Heuristic classification fallback — works on any form, including post-login.
  const fields = collectFields(opts);
  for (const { el, signals } of fields) {
    const c = classifyField(signals);
    if (!c) {
      skipped++;
      continue;
    }
    const value = valueForKey(profile, c.key);
    const label = signals.label || signals.name || c.key;
    const fillable = shouldFill(c);
    if (value && fillable) {
      if (applyValue(el, value)) {
        highlight(el, "filled");
        filled.push({ key: c.key, label });
      } else skipped++;
    } else {
      highlight(el, "ambiguous");
      ambiguous.push({ key: c.key, label });
    }
  }
  return { mode: "heuristic", filled, ambiguous, skipped, total: fields.length };
}

export function scanPage(opts: FillOptions = {}): FillResult {
  const fields = collectFields(opts);
  const filled: FillResult["filled"] = [];
  const ambiguous: FillResult["ambiguous"] = [];
  let skipped = 0;
  for (const { signals } of fields) {
    const c = classifyField(signals);
    if (!c) {
      skipped++;
      continue;
    }
    const label = signals.label || signals.name || "(field)";
    if (shouldFill(c)) filled.push({ key: c.key, label });
    else ambiguous.push({ key: c.key, label });
  }
  return { mode: "heuristic", filled, ambiguous, skipped, total: fields.length };
}
