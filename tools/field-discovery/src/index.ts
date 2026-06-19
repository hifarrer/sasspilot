import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyField, shouldFill } from "@aisas/shared/classifier";
import { extractInPage, type RawField } from "@aisas/shared/extract-in-page";
import type { FieldMapEntry } from "@aisas/shared/types";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(REPO_ROOT, "data", "field-maps");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
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
