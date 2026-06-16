import type { StartupProfile } from "@aisas/shared";
import type { ProfileInput } from "@aisas/shared";
import type { Profile } from "@prisma/client";

function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** DB row -> shared StartupProfile (used by API responses + the extension). */
export function toStartupProfile(p: Profile): StartupProfile {
  return {
    id: p.id,
    startupName: p.startupName,
    tagline: p.tagline,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    websiteUrl: p.websiteUrl,
    contactEmail: p.contactEmail,
    founderName: p.founderName,
    logoUrl: p.logoUrl,
    screenshots: safeArray(p.screenshotsJson),
    category: p.category,
    pricingModel: p.pricingModel,
    twitter: p.twitter,
    linkedin: p.linkedin,
    github: p.github,
  };
}

/** Validated ProfileInput -> Prisma create/update data (screenshots -> JSON). */
export function toProfileData(input: ProfileInput) {
  return {
    startupName: input.startupName,
    tagline: input.tagline,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    websiteUrl: input.websiteUrl,
    contactEmail: input.contactEmail,
    founderName: input.founderName,
    logoUrl: input.logoUrl ?? null,
    screenshotsJson: JSON.stringify(input.screenshots ?? []),
    category: input.category ?? null,
    pricingModel: input.pricingModel ?? null,
    twitter: input.twitter ?? null,
    linkedin: input.linkedin ?? null,
    github: input.github ?? null,
  };
}
