import Anthropic from "@anthropic-ai/sdk";
import type { GenerateDescriptionOutput } from "@aisas/shared";

// Default model. The user chose Sonnet for cost in the approved plan; Opus 4.8 is
// selectable per-request for higher quality.
const DEFAULT_MODEL = process.env.AI_MODEL || "claude-sonnet-4-6";

let cached: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  cached ??= new Anthropic();
  return cached;
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Forced tool use gives us reliable structured JSON without relying on prefills
// (removed on current models) or the newest SDK's structured-output helpers.
const COPY_TOOL = {
  name: "save_startup_copy",
  description: "Save concise, accurate marketing copy for a startup submission.",
  input_schema: {
    type: "object" as const,
    properties: {
      tagline: { type: "string", description: "Punchy one-liner, max ~60 characters." },
      shortDescription: {
        type: "string",
        description: "1–2 sentence summary, max ~160 characters.",
      },
      longDescription: {
        type: "string",
        description: "Full description, ~3–5 sentences.",
      },
      category: {
        type: "string",
        description: "Primary category, e.g. 'SaaS', 'AI', 'Developer Tools', 'Productivity'.",
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "3–8 short, relevant tags.",
      },
    },
    required: ["tagline", "shortDescription", "longDescription", "category", "keywords"],
  },
};

export async function generateCopy(opts: {
  url: string;
  pageText: string;
  model?: string;
}): Promise<GenerateDescriptionOutput> {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not configured");

  const prompt = `You are writing copy to submit a startup to directories like Product Hunt and BetaList.

The startup's website is ${opts.url}. Text extracted from its landing page:

<page>
${opts.pageText.slice(0, 12_000)}
</page>

Write compelling, accurate copy grounded ONLY in what the page actually says — do not invent features, metrics, or claims. Then call the ${COPY_TOOL.name} tool with the result.`;

  const res = await client.messages.create({
    model: opts.model || DEFAULT_MODEL,
    max_tokens: 1024,
    tools: [COPY_TOOL],
    tool_choice: { type: "tool", name: COPY_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return structured copy");
  }
  const raw = block.input as Partial<GenerateDescriptionOutput>;

  // Clamp to the schema's limits so downstream validation never rejects a good result.
  return {
    tagline: (raw.tagline ?? "").slice(0, 80),
    shortDescription: (raw.shortDescription ?? "").slice(0, 200),
    longDescription: (raw.longDescription ?? "").slice(0, 1200),
    category: raw.category ?? "",
    keywords: (raw.keywords ?? []).slice(0, 12),
  };
}
