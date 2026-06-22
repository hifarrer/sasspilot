import { classifyField, type FieldSignals, shouldFill } from "@aisas/shared/classifier";
import { type FieldMap, type StartupProfile, valueForKey } from "@aisas/shared/types";
import type { AiFillResult, EmptyField, FieldValue, FillResult } from "../lib/messages";

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

/** Temporary attribute used to re-find a field between SCAN_EMPTY and FILL_FIELDS. */
const FID_ATTR = "data-aisas-fid";

function isVisible(el: HTMLElement): boolean {
  const anyEl = el as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof anyEl.checkVisibility === "function") return anyEl.checkVisibility();
  return el.offsetParent !== null;
}

function escapeId(id: string): string {
  const cssNs = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  return cssNs?.escape ? cssNs.escape(id) : id.replace(/["\\]/g, "\\$&");
}

/** True for a rich-text editor root (contenteditable div / role=textbox), not an <input>. */
function isContentEditableEl(el: Element): boolean {
  const ce = el.getAttribute("contenteditable");
  if (ce === "" || ce === "true") return true;
  if (el.getAttribute("role") === "textbox" && ce !== "false") return true;
  return false;
}

/** Only the outermost editor counts — skip a contenteditable nested inside another. */
function isEditorRoot(el: Element): boolean {
  if (!isContentEditableEl(el)) return false;
  let p = el.parentElement;
  while (p) {
    if (isContentEditableEl(p)) return false;
    p = p.parentElement;
  }
  return true;
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

/** Build classifier signals for one element. Contenteditable masquerades as a textarea. */
function buildSignals(el: Element, type: string, tag: string): FieldSignals {
  const maxLen = (el as HTMLInputElement).maxLength;
  return {
    label: getLabel(el).replace(/\s+/g, " ").trim(),
    name: el.getAttribute("name"),
    id: el.getAttribute("id"),
    placeholder: el.getAttribute("placeholder"),
    ariaLabel: el.getAttribute("aria-label"),
    autocomplete: el.getAttribute("autocomplete"),
    type,
    tagName: tag,
    maxLength: maxLen && maxLen > 0 ? maxLen : null,
  };
}

export function collectFields(opts: FillOptions = {}): Array<{ el: HTMLElement; signals: FieldSignals }> {
  const out: Array<{ el: HTMLElement; signals: FieldSignals }> = [];

  const els = Array.from(document.querySelectorAll<Fillable>("input, textarea, select"));
  for (const el of els) {
    if (el.disabled || (el as HTMLInputElement).readOnly) continue;
    if (!opts.includeHidden && !isVisible(el)) continue;

    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? (el as HTMLInputElement).type : tag;
    if (tag === "input" && SKIP_INPUT_TYPES.has(type)) continue;

    out.push({ el, signals: buildSignals(el, type, tag) });
  }

  // Rich-text editors (TipTap / ProseMirror / Quill render as contenteditable divs).
  // Treat them as textareas so description copy routes to the right canonical key.
  const editors = Array.from(
    document.querySelectorAll<HTMLElement>('[contenteditable=""], [contenteditable="true"], [role="textbox"]'),
  );
  for (const el of editors) {
    if (!isEditorRoot(el)) continue;
    if (el.closest("input, textarea, select")) continue;
    if (!opts.includeHidden && !isVisible(el)) continue;
    out.push({ el, signals: buildSignals(el, "contenteditable", "textarea") });
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

/** Insert text into a rich-text editor in a way frameworks actually register. */
function fillContentEditable(el: HTMLElement, value: string): boolean {
  try {
    el.focus();
    const sel = window.getSelection?.();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const ok = document.execCommand?.("insertText", false, value);
    if (ok && (el.textContent ?? "").length > 0) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
  } catch {
    // fall through to the textContent fallback
  }

  el.textContent = value;
  try {
    el.dispatchEvent(
      new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: value }),
    );
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }),
    );
  } catch {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const v = value.toLowerCase();
  const opt =
    Array.from(el.options).find((o) => o.text.toLowerCase() === v || o.value.toLowerCase() === v) ??
    Array.from(el.options).find(
      (o) => o.text.toLowerCase().includes(v) || o.value.toLowerCase().includes(v),
    );
  if (!opt) return false;
  el.value = opt.value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/** Check the radio in a named group whose label/value best matches the value. */
function fillRadioGroup(name: string, value: string): boolean {
  const radios = Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name.replace(/"/g, '\\"')}"]`),
  );
  if (radios.length === 0) return false;
  const v = value.toLowerCase().trim();
  const match =
    radios.find((r) => r.value.toLowerCase() === v || getLabel(r).trim().toLowerCase() === v) ??
    radios.find(
      (r) =>
        r.value.toLowerCase().includes(v) || getLabel(r).toLowerCase().includes(v) || v.includes(r.value.toLowerCase()),
    );
  if (!match) return false;
  match.checked = true;
  match.dispatchEvent(new Event("input", { bubbles: true }));
  match.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function applyValue(el: Element, value: string): boolean {
  if (el instanceof HTMLSelectElement) return fillSelect(el, value);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value);
    return true;
  }
  if (el instanceof HTMLElement && (isContentEditableEl(el) || el.isContentEditable)) {
    return fillContentEditable(el, value);
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

/** Current text content of any fillable element. */
function currentValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  if (el instanceof HTMLSelectElement) return el.value;
  return (el.textContent ?? "").trim();
}

/** Visible option labels for a <select>, skipping a leading empty/placeholder option. */
function selectOptions(el: HTMLSelectElement): string[] {
  return Array.from(el.options)
    .filter((o) => o.value !== "" && o.text.trim() !== "")
    .map((o) => o.text.trim());
}

/**
 * Find every still-empty fillable field and tag it so FILL_FIELDS can re-find it.
 * Returns lightweight descriptors for the AI to fill (text, rich-text, selects, radios).
 */
export function collectEmptyFields(opts: FillOptions = {}): EmptyField[] {
  // Clear any markers from a previous scan so ids stay stable per scan.
  for (const el of Array.from(document.querySelectorAll(`[${FID_ATTR}]`))) {
    el.removeAttribute(FID_ATTR);
  }

  const out: EmptyField[] = [];
  let next = 0;
  const tag = (el: Element): string => {
    const id = String(next++);
    el.setAttribute(FID_ATTR, id);
    return id;
  };
  const push = (el: Element, signals: FieldSignals, options?: string[]) => {
    const c = classifyField(signals);
    out.push({
      id: tag(el),
      label: signals.label ?? undefined,
      name: signals.name ?? undefined,
      placeholder: signals.placeholder ?? undefined,
      type: signals.type ?? "text",
      tag: signals.tagName ?? "input",
      maxLength: signals.maxLength ?? null,
      classifiedKey: c?.key ?? null,
      options,
    });
  };

  // Inputs, textareas, selects.
  for (const el of Array.from(document.querySelectorAll<Fillable>("input, textarea, select"))) {
    if (el.disabled || (el as HTMLInputElement).readOnly) continue;
    if (!opts.includeHidden && !isVisible(el)) continue;

    const tagName = el.tagName.toLowerCase();
    const type = tagName === "input" ? (el as HTMLInputElement).type : tagName;
    if (tagName === "input" && SKIP_INPUT_TYPES.has(type)) continue;
    if (currentValue(el).trim() !== "") continue;

    const options = el instanceof HTMLSelectElement ? selectOptions(el) : undefined;
    push(el, buildSignals(el, type, tagName), options);
  }

  // Radio groups: one entry per unchecked group, options = the radios' labels.
  const seen = new Set<string>();
  for (const radio of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) {
    const name = radio.getAttribute("name");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const group = Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name.replace(/"/g, '\\"')}"]`),
    );
    if (group.some((r) => r.checked)) continue;
    if (!opts.includeHidden && !group.some((r) => isVisible(r))) continue;
    const options = group.map((r) => getLabel(r).replace(/\s+/g, " ").trim() || r.value).filter(Boolean);
    const groupLabel =
      radio.closest("fieldset")?.querySelector("legend")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    push(group[0]!, { label: groupLabel || name, name, type: "radio", tagName: "input" }, options);
  }

  // Rich-text editors that are still empty.
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>('[contenteditable=""], [contenteditable="true"], [role="textbox"]'),
  )) {
    if (!isEditorRoot(el)) continue;
    if (el.closest("input, textarea, select")) continue;
    if (!opts.includeHidden && !isVisible(el)) continue;
    if (currentValue(el) !== "") continue;
    push(el, buildSignals(el, "contenteditable", "textarea"));
  }

  return out;
}

/** Apply AI-generated values to the fields tagged by collectEmptyFields, then clean up. */
export function applyFields(values: FieldValue[]): AiFillResult {
  let filled = 0;
  for (const { id, value } of values) {
    if (!value) continue;
    const el = document.querySelector<HTMLElement>(`[${FID_ATTR}="${escapeId(id)}"]`);
    if (!el) continue;

    let ok = false;
    if (el instanceof HTMLInputElement && el.type === "radio") {
      ok = fillRadioGroup(el.getAttribute("name") ?? "", value);
    } else {
      ok = applyValue(el, value);
    }
    if (ok) {
      highlight(el, "filled");
      filled++;
    }
  }

  for (const el of Array.from(document.querySelectorAll(`[${FID_ATTR}]`))) {
    el.removeAttribute(FID_ATTR);
  }

  return { filled, total: values.length };
}
