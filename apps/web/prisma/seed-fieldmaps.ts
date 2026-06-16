/**
 * Import discovered/curated field maps from data/field-maps/*.json into the DB.
 * Drafts that require login or have no usable fields are skipped.
 *
 *   pnpm --filter @aisas/web exec tsx prisma/seed-fieldmaps.ts
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = path.resolve(__dirname, "../../../data/field-maps");

const db = new PrismaClient();

interface Draft {
  directorySlug: string;
  domain: string | null;
  discoveredBy: string;
  confidence: number;
  requiresLogin: boolean;
  fields: unknown[];
}

async function main() {
  let files: string[] = [];
  try {
    files = (await readdir(MAPS_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    console.log(`No ${MAPS_DIR} directory yet — run the field-discovery tool first.`);
    return;
  }

  let imported = 0;
  let skipped = 0;
  for (const file of files) {
    const draft: Draft = JSON.parse(await readFile(path.join(MAPS_DIR, file), "utf8"));
    if (draft.requiresLogin || !draft.fields?.length) {
      skipped++;
      continue;
    }
    const dir = await db.directory.findUnique({ where: { slug: draft.directorySlug } });
    if (!dir) {
      console.warn(`  ✗ no directory for slug "${draft.directorySlug}" (${file})`);
      skipped++;
      continue;
    }
    await db.fieldMap.upsert({
      where: { directoryId_version: { directoryId: dir.id, version: 1 } },
      create: {
        directoryId: dir.id,
        domain: dir.domain,
        version: 1,
        fieldsJson: JSON.stringify(draft.fields),
        discoveredBy: draft.discoveredBy,
        confidence: draft.confidence,
        lastVerifiedAt: new Date(),
      },
      update: {
        fieldsJson: JSON.stringify(draft.fields),
        discoveredBy: draft.discoveredBy,
        confidence: draft.confidence,
        lastVerifiedAt: new Date(),
      },
    });
    imported++;
  }
  console.log(`✅ Field maps imported: ${imported}, skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
