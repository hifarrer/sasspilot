import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../../../data/directories.json");

const db = new PrismaClient();

interface ScrapedDirectory {
  slug: string;
  name: string;
  domain: string;
  submissionUrl: string;
  domainRating: number | null;
  category: string | null;
  categoryRank: number | null;
  categorySize: number | null;
  cost: string;
  backlinkType: string;
  editorsPick: boolean;
  knownFor: string | null;
  description: string | null;
  sourceUrl: string;
  lastVerifiedAt: string | null;
}

async function main() {
  const raw = await readFile(DATA_FILE, "utf8").catch(() => {
    throw new Error(
      `Could not read ${DATA_FILE}. Run the scraper first: pnpm --filter @aisas/scraper start`,
    );
  });
  const directories: ScrapedDirectory[] = JSON.parse(raw);
  console.log(`Seeding ${directories.length} directories…`);

  let count = 0;
  for (const d of directories) {
    const data = {
      name: d.name,
      domain: d.domain,
      submissionUrl: d.submissionUrl,
      domainRating: d.domainRating,
      category: d.category,
      categoryRank: d.categoryRank,
      categorySize: d.categorySize,
      cost: d.cost,
      backlinkType: d.backlinkType,
      editorsPick: d.editorsPick,
      knownFor: d.knownFor,
      description: d.description,
      source: "clakr",
      sourceUrl: d.sourceUrl,
      lastVerifiedAt: d.lastVerifiedAt ? new Date(d.lastVerifiedAt) : null,
    };
    await db.directory.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, ...data },
      update: data,
    });
    if (++count % 100 === 0) console.log(`  …${count}`);
  }

  const total = await db.directory.count();
  console.log(`✅ Seeded. Directory rows in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
