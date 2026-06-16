import type { CanonicalKey } from "./canonicalFields";

export type Cost = "free" | "paid" | "freemium";
export type BacklinkType = "dofollow" | "nofollow" | "none";
export type SubmissionStatus =
  | "not_started"
  | "pending"
  | "submitted"
  | "published"
  | "rejected";
export type DirectorySource = "clakr" | "public" | "manual";
export type SelectorType = "css" | "xpath";
export type DiscoveredBy = "playwright" | "manual" | "heuristic";

/** A curated startup-submission directory (one row of the catalog). */
export interface Directory {
  id: string;
  slug: string;
  name: string;
  domain: string;
  submissionUrl: string;
  domainRating: number | null;
  category: string | null;
  categoryRank: number | null;
  cost: Cost;
  price: string | null;
  backlinkType: BacklinkType;
  description: string | null;
  instructions: string | null;
  requiresLogin: boolean;
  language: string;
  source: DirectorySource;
  tags: string[];
  lastVerifiedAt: string | null;
}

/** The user's startup profile — the source of values used to fill forms. */
export interface StartupProfile {
  id: string;
  startupName: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  websiteUrl: string;
  contactEmail: string;
  founderName: string;
  logoUrl: string | null;
  screenshots: string[];
  category: string | null;
  pricingModel: string | null;
  twitter: string | null;
  linkedin: string | null;
  github: string | null;
}

/** A CRM row tracking one profile's submission to one directory. */
export interface Submission {
  id: string;
  directoryId: string;
  profileId: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  publishedAt: string | null;
  postUrl: string | null;
  notes: string | null;
}

/** A precise selector mapping for one canonical field on a specific site. */
export interface FieldMapEntry {
  canonicalKey: CanonicalKey;
  selector: string;
  selectorType: SelectorType;
  inputType?: string;
  required?: boolean;
  /** For select/radio: the option label to choose. */
  optionText?: string;
}

/** A curated/discovered set of field selectors for one directory's form. */
export interface FieldMap {
  directoryId: string;
  domain: string;
  version: number;
  fields: FieldMapEntry[];
  discoveredBy: DiscoveredBy;
  confidence: number;
  lastVerifiedAt: string | null;
}

/** Maps a canonical field key to the StartupProfile property that supplies its value. */
export const PROFILE_FIELD_BY_KEY: Record<CanonicalKey, keyof StartupProfile> = {
  startupName: "startupName",
  tagline: "tagline",
  shortDescription: "shortDescription",
  longDescription: "longDescription",
  websiteUrl: "websiteUrl",
  email: "contactEmail",
  founderName: "founderName",
  logo: "logoUrl",
  category: "category",
  pricing: "pricingModel",
  twitter: "twitter",
  linkedin: "linkedin",
  github: "github",
};

/** Resolve the string value a profile provides for a given canonical key. */
export function valueForKey(profile: StartupProfile, key: CanonicalKey): string | null {
  const prop = PROFILE_FIELD_BY_KEY[key];
  const value = profile[prop];
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return String(value);
}
