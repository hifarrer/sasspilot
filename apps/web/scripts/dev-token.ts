/**
 * Dev helper: create (or reuse) a test user + startup profile and mint a fresh
 * personal access token. Prints IDs + token so you can exercise the PAT-protected
 * APIs without configuring OAuth.
 *
 *   pnpm --filter @aisas/web exec tsx scripts/dev-token.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = "dev@example.com";
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "Dev User" },
    update: {},
  });

  let profile = await db.profile.findFirst({ where: { userId: user.id } });
  if (!profile) {
    profile = await db.profile.create({
      data: {
        userId: user.id,
        startupName: "Acme AI",
        tagline: "Ship faster with AI",
        shortDescription: "Acme AI helps teams automate their busywork with AI agents.",
        longDescription:
          "Acme AI is a platform that lets product teams build and deploy AI agents to automate repetitive workflows, from support triage to data entry.",
        websiteUrl: "https://acme.ai",
        contactEmail: "founder@acme.ai",
        founderName: "Jane Doe",
        category: "SaaS",
        pricingModel: "freemium",
        twitter: "https://twitter.com/acme",
        github: "https://github.com/acme/acme",
      },
    });
  }

  const token = `aisas_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  await db.apiToken.create({ data: { userId: user.id, tokenHash: hash, label: "dev-cli" } });

  console.log(`USER_ID=${user.id}`);
  console.log(`PROFILE_ID=${profile.id}`);
  console.log(`TOKEN=${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
