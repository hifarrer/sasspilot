import { z } from "zod";

/** AI description generation — request. */
export const generateDescriptionInput = z.object({
  url: z.string().url(),
  model: z.enum(["claude-sonnet-4-6", "claude-opus-4-8"]).optional(),
});
export type GenerateDescriptionInput = z.infer<typeof generateDescriptionInput>;

/** AI description generation — structured response. */
export const generateDescriptionOutput = z.object({
  tagline: z.string().max(80),
  shortDescription: z.string().max(200),
  longDescription: z.string().max(1200),
  category: z.string(),
  keywords: z.array(z.string()).max(12),
});
export type GenerateDescriptionOutput = z.infer<typeof generateDescriptionOutput>;

const optionalUrl = z.union([z.string().url(), z.literal("")]).nullable().optional();

/** Create/update a startup profile. */
export const profileInput = z.object({
  startupName: z.string().min(1, "Name is required"),
  tagline: z.string().default(""),
  shortDescription: z.string().default(""),
  longDescription: z.string().default(""),
  websiteUrl: z.union([z.string().url(), z.literal("")]).default(""),
  contactEmail: z.union([z.string().email(), z.literal("")]).default(""),
  founderName: z.string().default(""),
  logoUrl: optionalUrl,
  screenshots: z.array(z.string().url()).default([]),
  category: z.string().nullable().optional(),
  pricingModel: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  github: z.string().nullable().optional(),
});
export type ProfileInput = z.infer<typeof profileInput>;

/** AI fill of arbitrary leftover form fields — request. */
export const fillFieldsInput = z.object({
  profile: profileInput,
  fields: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        name: z.string().optional(),
        placeholder: z.string().optional(),
        nearbyText: z.string().optional(),
        type: z.string(),
        tag: z.string(),
        maxLength: z.number().nullable().optional(),
        classifiedKey: z.string().nullable().optional(),
        options: z.array(z.string()).optional(),
      }),
    )
    .max(60),
  model: z.enum(["claude-sonnet-4-6", "claude-opus-4-8"]).optional(),
});
export type FillFieldsInput = z.infer<typeof fillFieldsInput>;
export type FillFieldDescriptor = FillFieldsInput["fields"][number];

/** AI fill of arbitrary leftover form fields — response. */
export const fillFieldsOutput = z.object({
  values: z.array(z.object({ id: z.string(), value: z.string() })),
});
export type FillFieldsOutput = z.infer<typeof fillFieldsOutput>;

export const submissionStatus = z.enum([
  "not_started",
  "pending",
  "submitted",
  "published",
  "rejected",
]);

/** Create/update a CRM submission row. */
export const submissionInput = z.object({
  directoryId: z.string().min(1),
  profileId: z.string().min(1),
  status: submissionStatus,
  postUrl: optionalUrl,
  notes: z.string().nullable().optional(),
});
export type SubmissionInput = z.infer<typeof submissionInput>;

/** Issue an extension personal-access token. */
export const tokenInput = z.object({
  label: z.string().min(1).max(60),
});
export type TokenInput = z.infer<typeof tokenInput>;
