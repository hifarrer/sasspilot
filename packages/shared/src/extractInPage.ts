import type { FieldSignals } from "./classifier";

/** One fillable field as read from a live page: its signals + a stable selector. */
export interface RawField {
  signals: FieldSignals;
  selector: string;
  isPassword: boolean;
}

/**
 * Runs IN THE PAGE (via Playwright `page.evaluate`): collect every fillable field's
 * signals + a stable CSS selector. Must stay self-contained — all helpers are nested
 * so the serialized function carries them into the page context.
 *
 * NOTE: when this is passed to `page.evaluate`, tsx/esbuild's keepNames wraps named
 * functions with `__name(...)`, which is undefined in the page. Define it first with
 * `addInitScript(() => { globalThis.__name ??= (f) => f; })` before any evaluate.
 */
export function extractInPage(): RawField[] {
  const cssEscape = (s: string) =>
    (window as { CSS?: { escape?: (v: string) => string } }).CSS?.escape?.(s) ??
    s.replace(/["\\]/g, "\\$&");

  function selectorFor(el: Element): string {
    if (el.id) return `#${cssEscape(el.id)}`;
    const name = el.getAttribute("name");
    if (name) {
      const sel = `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && node.parentElement) {
      let part = node.tagName.toLowerCase();
      const sameTag = Array.from(node.parentElement.children).filter(
        (c) => c.tagName === node!.tagName,
      );
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function labelFor(el: Element): string {
    const id = el.getAttribute("id");
    if (id) {
      const l = document.querySelector(`label[for="${cssEscape(id)}"]`);
      if (l?.textContent) return l.textContent;
    }
    const wrap = el.closest("label");
    if (wrap?.textContent) return wrap.textContent;
    const lb = el.getAttribute("aria-labelledby");
    if (lb) {
      const ref = document.getElementById(lb);
      if (ref?.textContent) return ref.textContent;
    }
    const prev = el.previousElementSibling;
    if (prev?.textContent && prev.textContent.length < 80) return prev.textContent;
    return "";
  }

  const els = Array.from(
    document.querySelectorAll("input, textarea, select"),
  ) as HTMLInputElement[];
  return els.map((el) => {
    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? el.type : tag;
    return {
      selector: selectorFor(el),
      isPassword: type === "password",
      signals: {
        label: labelFor(el).replace(/\s+/g, " ").trim(),
        name: el.getAttribute("name"),
        id: el.getAttribute("id"),
        placeholder: el.getAttribute("placeholder"),
        ariaLabel: el.getAttribute("aria-label"),
        autocomplete: el.getAttribute("autocomplete"),
        type,
        tagName: tag,
        maxLength: el.maxLength && el.maxLength > 0 ? el.maxLength : null,
      },
    };
  });
}
