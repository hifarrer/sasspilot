import type { GenerateDescriptionOutput } from "@aisas/shared/schemas";
import type { FieldMap, StartupProfile } from "@aisas/shared/types";
import { APP_URL } from "./config";
import type { EmptyField, FieldValue } from "./messages";
import { getSettings } from "./storage";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = await getSettings();
  if (!token) throw new Error("Please sign in first.");
  const res = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** The server-validated subset of a profile (drops the client-only `id`). */
function toProfileInput(p: StartupProfile) {
  return {
    startupName: p.startupName,
    tagline: p.tagline,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    websiteUrl: p.websiteUrl,
    contactEmail: p.contactEmail,
    founderName: p.founderName,
    logoUrl: p.logoUrl,
    screenshots: p.screenshots,
    category: p.category,
    pricingModel: p.pricingModel,
    twitter: p.twitter,
    linkedin: p.linkedin,
    github: p.github,
  };
}

export async function createProfile(input: StartupProfile): Promise<StartupProfile> {
  const { profile } = await api<{ profile: StartupProfile }>("/api/profiles", {
    method: "POST",
    body: JSON.stringify(toProfileInput(input)),
  });
  return profile;
}

export async function updateProfile(id: string, input: StartupProfile): Promise<StartupProfile> {
  const { profile } = await api<{ profile: StartupProfile }>(`/api/profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toProfileInput(input)),
  });
  return profile;
}

export interface DirectoryLite {
  id: string;
  name: string;
  domain: string;
  slug: string;
}

export async function fetchProfiles(): Promise<StartupProfile[]> {
  const { profiles } = await api<{ profiles: StartupProfile[] }>("/api/profiles");
  return profiles;
}

export async function generateDescription(
  url: string,
  model?: string,
): Promise<GenerateDescriptionOutput> {
  return api<GenerateDescriptionOutput>("/api/ai/generate-description", {
    method: "POST",
    body: JSON.stringify({ url, model }),
  });
}

/** Ask the backend AI to fill leftover empty fields, grounded in the profile. */
export async function fillFields(
  profile: StartupProfile,
  fields: EmptyField[],
  model?: string,
): Promise<FieldValue[]> {
  const { values } = await api<{ values: FieldValue[] }>("/api/ai/fill-fields", {
    method: "POST",
    body: JSON.stringify({ profile: toProfileInput(profile), fields, model }),
  });
  return values;
}

export async function findDirectoryByDomain(domain: string): Promise<DirectoryLite | null> {
  const { items } = await api<{ items: DirectoryLite[] }>(
    `/api/directories?q=${encodeURIComponent(domain)}&pageSize=5`,
  );
  return items.find((d) => d.domain === domain) ?? items[0] ?? null;
}

/** Best-effort: a curated field map for the domain, or null (heuristic fallback). */
export async function fetchFieldMap(domain: string): Promise<FieldMap | null> {
  try {
    const { fieldMap } = await api<{ fieldMap: FieldMap | null }>(
      `/api/field-maps?domain=${encodeURIComponent(domain)}`,
    );
    return fieldMap;
  } catch {
    return null;
  }
}

export async function markSubmitted(input: {
  directoryId: string;
  profileId: string;
  status: string;
  postUrl?: string | null;
}): Promise<void> {
  await api("/api/submissions", { method: "POST", body: JSON.stringify(input) });
}
