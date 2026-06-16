import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyField, type FieldSignals, shouldFill } from "@aisas/shared/classifier";
import type { FieldMapEntry } from "@aisas/shared/types";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(REPO_ROOT, "data", "field-maps");

interface RawField {
  signals: FieldSignals;
  selector: string;
  isPassword: boolean;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/** Runs in the page: collect every fillable field's signals + a stable CSS selector. */
function extractInPage(): RawField[] {
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

async function main() {
  const url = arg("url");
  const file = arg("file");
  const slug = arg("slug");
  const domain = arg("domain");
  if ((!url && !file) || !slug) {
    console.error(
      "Usage: tsx src/index.ts (--url <URL> | --file <path>) --slug <directory-slug> [--domain <domain>]",
    );
    process.exit(1);
  }

  const target = url ?? pathToFileURL(path.resolve(file!)).href;
  console.log(`Discovering fields on ${target} …`);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  // tsx/esbuild wraps named functions with __name(); define it in the page so the
  // serialized extractInPage() resolves it (otherwise: "__name is not defined").
  await page.addInitScript(() => {
    const g = globalThis as unknown as { __name?: (f: unknown) => unknown };
    g.__name ??= (f) => f;
  });

  let raw: RawField[] = [];
  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(800);
    raw = await page.evaluate(extractInPage);
  } finally {
    await browser.close();
  }

  const fields: FieldMapEntry[] = [];
  const review: Array<{ selector: string; label: string; guessedKey: string; confidence: string }> = [];
  let classifiable = 0;

  for (const f of raw) {
    const c = classifyField(f.signals);
    if (!c) continue;
    classifiable++;
    const inputType = f.signals.type ?? undefined;
    if (shouldFill(c)) {
      fields.push({
        canonicalKey: c.key,
        selector: f.selector,
        selectorType: "css",
        inputType,
      });
    } else {
      review.push({
        selector: f.selector,
        label: f.signals.label || f.signals.name || "",
        guessedKey: c.key,
        confidence: c.confidence,
      });
    }
  }

  const requiresLogin = raw.some((f) => f.isPassword) || fields.length === 0;
  const draft = {
    directorySlug: slug,
    domain: domain ?? null,
    sourceUrl: target,
    discoveredBy: "playwright" as const,
    generatedAt: new Date().toISOString(),
    requiresLogin,
    confidence: raw.length ? Number((classifiable / raw.length).toFixed(2)) : 0,
    fields,
    review,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${slug}.json`);
  await writeFile(outPath, JSON.stringify(draft, null, 2), "utf8");

  console.log(
    `✅ ${slug}: ${fields.length} mapped, ${review.length} to review, requiresLogin=${requiresLogin}`,
  );
  console.log(`   → ${path.relative(REPO_ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
