import Anthropic from "@anthropic-ai/sdk";
import type { Candidate } from "./heuristics";

// Mirrors apps/web/lib/anthropic.ts: forced tool use for reliable structured JSON.
const DEFAULT_MODEL = process.env.AI_MODEL || "claude-sonnet-4-6";
const OPUS_MODEL = "claude-opus-4-8";

let cached: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  cached ??= new Anthropic();
  return cached;
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const PICK_TOOL = {
  name: "pick_submit_url",
  description:
    "Record the single best URL where a founder submits THEIR OWN product/startup to be listed.",
  input_schema: {
    type: "object" as const,
    properties: {
      submitUrl: {
        type: "string",
        description:
          "Absolute URL of the self-serve submission/add-listing page. Empty string if none exists.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "How sure you are this is the real submission page.",
      },
      isManual: {
        type: "boolean",
        description:
          "True if the site has NO self-serve submission form (community, subreddit, requires email/DM, or a developer-account platform).",
      },
      reason: { type: "string", description: "One short sentence explaining the choice." },
    },
    required: ["submitUrl", "confidence", "isManual", "reason"],
  },
};

export interface AiPick {
  submitUrl: string;
  confidence: "high" | "medium" | "low";
  isManual: boolean;
  reason: string;
}

export interface AdjudicateInput {
  name: string;
  domain: string;
  homepageUrl: string;
  links: { href: string; text: string }[];
  candidates: Candidate[];
  pageText: string;
  opus?: boolean;
}

/** Ask Claude to choose the real submission URL from the gathered context. */
export async function adjudicate(input: AdjudicateInput): Promise<AiPick | null> {
  const client = getClient();
  if (!client) return null;

  const candidateList = input.candidates
    .slice(0, 12)
    .map((c) => `- ${c.url}  (score ${c.score}${c.formConfirmed ? ", form found" : ""})`)
    .join("\n");
  const linkList = input.links
    .slice(0, 50)
    .map((l) => `- ${l.href}  "${l.text}"`)
    .join("\n");

  const prompt = `You are finding the page on a startup directory where a founder submits THEIR OWN product or startup to be listed/featured.

Directory: ${input.name}
Domain: ${input.domain}
Homepage: ${input.homepageUrl}

Heuristic candidate URLs (may be empty or wrong):
${candidateList || "(none)"}

Links found on the homepage:
${linkList || "(none)"}

Homepage text excerpt:
<page>
${input.pageText.slice(0, 5000)}
</page>

Rules:
- Pick the URL where a founder ADDS/SUBMITS their product (e.g. "Submit", "Add your tool", "Get listed", "/submit", "/products/new"). NOT login, signup, pricing, contact, or a blog post.
- Prefer a URL from the lists above. Only infer a path on ${input.domain} if the page clearly implies one.
- If there is no self-serve submission page — it's a community/subreddit, requires emailing/DMing the owner, or needs a developer account — set isManual=true and submitUrl="".
Then call ${PICK_TOOL.name}.`;

  let res: Anthropic.Message;
  try {
    res = await client.messages.create({
      model: input.opus ? OPUS_MODEL : DEFAULT_MODEL,
      max_tokens: 512,
      tools: [PICK_TOOL],
      tool_choice: { type: "tool", name: PICK_TOOL.name },
      messages: [{ role: "user", content: prompt }],
    });
  } catch {
    return null;
  }

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  const raw = block.input as Partial<AiPick>;
  return {
    submitUrl: (raw.submitUrl ?? "").trim(),
    confidence: raw.confidence ?? "low",
    isManual: !!raw.isManual,
    reason: (raw.reason ?? "").slice(0, 240),
  };
}
