/**
 * Canonical field keys — the single vocabulary the whole system maps to.
 *
 * The extension content script, the web app, and the Playwright field-discovery
 * tool all classify arbitrary form fields into these keys, so the mapping logic
 * lives in exactly one place (see ./classifier.ts).
 */
export const CANONICAL_KEYS = [
  "startupName",
  "tagline",
  "shortDescription",
  "longDescription",
  "websiteUrl",
  "email",
  "founderName",
  "logo",
  "category",
  "pricing",
  "twitter",
  "linkedin",
  "github",
] as const;

export type CanonicalKey = (typeof CANONICAL_KEYS)[number];

export interface CanonicalFieldMeta {
  key: CanonicalKey;
  /** Human-readable label shown in the extension UI. */
  label: string;
  /** Short hint describing the expected value. */
  hint: string;
  /** Value is typically multi-line (prefers a textarea). */
  multiline?: boolean;
  /** File-upload field (e.g. logo) — cannot be auto-filled by the extension. */
  fileUpload?: boolean;
}

export const CANONICAL_FIELDS: Record<CanonicalKey, CanonicalFieldMeta> = {
  startupName: {
    key: "startupName",
    label: "Startup / product name",
    hint: "The name of the product or company",
  },
  tagline: {
    key: "tagline",
    label: "Tagline",
    hint: "One-line slogan (≤ 60 chars)",
  },
  shortDescription: {
    key: "shortDescription",
    label: "Short description",
    hint: "1–2 sentence summary (≤ 160 chars)",
  },
  longDescription: {
    key: "longDescription",
    label: "Long description",
    hint: "Full description / pitch",
    multiline: true,
  },
  websiteUrl: {
    key: "websiteUrl",
    label: "Website URL",
    hint: "Your product's homepage",
  },
  email: {
    key: "email",
    label: "Contact email",
    hint: "Contact / account email",
  },
  founderName: {
    key: "founderName",
    label: "Your name",
    hint: "The submitter / founder name",
  },
  logo: {
    key: "logo",
    label: "Logo / image",
    hint: "Logo upload (cannot be auto-filled)",
    fileUpload: true,
  },
  category: {
    key: "category",
    label: "Category",
    hint: "Primary category / topic",
  },
  pricing: {
    key: "pricing",
    label: "Pricing",
    hint: "Pricing model (free / paid / freemium)",
  },
  twitter: {
    key: "twitter",
    label: "Twitter / X",
    hint: "Twitter / X handle or URL",
  },
  linkedin: {
    key: "linkedin",
    label: "LinkedIn",
    hint: "LinkedIn URL",
  },
  github: {
    key: "github",
    label: "GitHub",
    hint: "GitHub repo / profile URL",
  },
};
