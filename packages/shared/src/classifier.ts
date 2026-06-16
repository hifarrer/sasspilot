import type { CanonicalKey } from "./canonicalFields";

/**
 * Raw signals collected from a single DOM form field. Every property is optional
 * so callers (content script, Playwright, tests) can supply whatever they have.
 */
export interface FieldSignals {
  /** Visible label text (via `for`, wrapping <label>, or preceding text). */
  label?: string | null;
  ariaLabel?: string | null;
  name?: string | null;
  id?: string | null;
  placeholder?: string | null;
  autocomplete?: string | null;
  /** Input `type` attribute, or "textarea" / "select" for those elements. */
  type?: string | null;
  /** Lowercased tag name: "input" | "textarea" | "select". */
  tagName?: string | null;
  maxLength?: number | null;
  /** Nearby heading / helper text, weakly weighted. */
  nearbyText?: string | null;
}

export type Confidence = "high" | "medium" | "low";

export interface Classification {
  key: CanonicalKey;
  score: number;
  confidence: Confidence;
  /** True when the match is weak or the runner-up is close — caller should not auto-fill. */
  ambiguous: boolean;
  alternatives: Array<{ key: CanonicalKey; score: number }>;
}

interface Rule {
  key: CanonicalKey;
  /** Keyword regexes. Matching any within a text source contributes that source's weight. */
  patterns: RegExp[];
  /** Disqualifying regexes — strongly penalize when matched in any source. */
  negative?: RegExp[];
  /** Input types that strongly indicate this key. */
  types?: string[];
  /** `autocomplete` tokens that strongly indicate this key. */
  autocomplete?: string[];
  /** Prefer a textarea element (adds a bonus when tagName === "textarea"). */
  prefersTextarea?: boolean;
}

// Source weighting: the visible label is the most reliable signal, attributes
// less so, nearby text least of all.
const SOURCE_WEIGHTS: Array<{ key: keyof FieldSignals; weight: number }> = [
  { key: "label", weight: 1.0 },
  { key: "ariaLabel", weight: 1.0 },
  { key: "placeholder", weight: 0.7 },
  { key: "name", weight: 0.8 },
  { key: "id", weight: 0.6 },
  { key: "nearbyText", weight: 0.35 },
];

const TYPE_BONUS = 1.4;
const AUTOCOMPLETE_BONUS = 1.6;
const TEXTAREA_BONUS = 0.5;
const NEGATIVE_PENALTY = 2.5;

/**
 * Normalize a raw signal: split camelCase, turn separators into spaces, lowercase.
 * e.g. "productURL" -> "product url", "your_full_name" -> "your full name".
 */
export function normalize(s?: string | null): string {
  return (s ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const RULES: Rule[] = [
  {
    key: "email",
    patterns: [/\be ?mail\b/, /\bemail address\b/],
    types: ["email"],
    autocomplete: ["email"],
  },
  {
    key: "websiteUrl",
    patterns: [
      /\bwebsite\b/,
      /\bweb site\b/,
      /\bhome ?page\b/,
      /\b(product|app|site|landing page) (url|link|website)\b/,
      /\bsite url\b/,
      /\blive (url|link|site|demo)\b/,
      /\bdemo (url|link)\b/,
      /\b(your )?url\b/,
      /\bwebsite url\b/,
      /\blanding page\b/,
      /\blink to (your )?(product|site|website|app)\b/,
    ],
    negative: [
      /twitter|linked ?in|git ?hub|facebook|instagram|youtube|tiktok|discord|mastodon|repo|repository|video|crunchbase|social|profile url/,
    ],
    types: ["url"],
    autocomplete: ["url"],
  },
  {
    key: "startupName",
    patterns: [
      /\b(product|startup|company|app|tool|business|project|saas|brand|service|software) name\b/,
      /\bname of (your |the )?(product|startup|company|app|tool|business|project)\b/,
      /\bproduct title\b/,
      /^title$/,
      /^name$/,
    ],
    negative: [
      /your name|full name|first name|last name|user ?name|nick ?name|contact name|display name|real name|screen name|file name|domain name|\buser\b|\blogin\b/,
    ],
  },
  {
    key: "founderName",
    patterns: [
      /\byour (full )?name\b/,
      /\bfull name\b/,
      /\bfirst name\b/,
      /\blast name\b/,
      /\bcontact name\b/,
      /\bfounder\b/,
      /\bmaker\b/,
      /\bsubmitter\b/,
      /\bowner name\b/,
      /\bauthor\b/,
    ],
    negative: [/product|company|startup|\bapp\b|business|file|domain|user ?name|display|screen/],
    autocomplete: ["name", "given-name", "family-name"],
  },
  {
    key: "tagline",
    patterns: [
      /\btag ?line\b/,
      /\bslogan\b/,
      /\bhead ?line\b/,
      /\bone[ -]?liner\b/,
      /\bshort pitch\b/,
      /\bhook\b/,
      /\bcatch ?phrase\b/,
      /\belevator pitch\b/,
      /\bmotto\b/,
      /\bsub ?title\b/,
      /\bpitch line\b/,
      /\bin one sentence\b/,
    ],
  },
  {
    key: "shortDescription",
    patterns: [
      /\bshort description\b/,
      /\bsummary\b/,
      /\bexcerpt\b/,
      /\bbrief\b/,
      /\btl ?;? ?dr\b/,
      /\bshort desc\b/,
      /\bmeta description\b/,
      /\bone[ -]?line description\b/,
      /\bshort (intro|blurb|summary)\b/,
      /\bblurb\b/,
    ],
  },
  {
    key: "longDescription",
    patterns: [
      /\bdescription\b/,
      /\babout\b/,
      /\bdetails\b/,
      /\boverview\b/,
      /\bpitch\b/,
      /\btell us\b/,
      /\blong description\b/,
      /\bfull description\b/,
      /\bmore (info|details)\b/,
      /\bproduct description\b/,
      /\bwhat (does|is)\b/,
      /\bdescribe\b/,
      /\bstory\b/,
      /\babstract\b/,
    ],
    negative: [/short description|meta description|summary|excerpt|tag ?line/],
    prefersTextarea: true,
  },
  {
    key: "category",
    patterns: [
      /\bcategor(y|ies)\b/,
      /\btopics?\b/,
      /\btags?\b/,
      /\bindustr(y|ies)\b/,
      /\bniche\b/,
      /\bsector\b/,
      /\bvertical\b/,
      /\bgenre\b/,
    ],
  },
  {
    key: "pricing",
    patterns: [
      /\bpricing\b/,
      /\bprice\b/,
      /\bcost\b/,
      /\bpricing model\b/,
      /\bbusiness model\b/,
      /\bfree or paid\b/,
      /\bmonetization\b/,
    ],
  },
  {
    key: "twitter",
    patterns: [/\btwitter\b/, /\bx handle\b/, /\bx\.com\b/, /\bx profile\b/, /\btwitter (handle|url|profile|username)\b/],
  },
  {
    key: "linkedin",
    patterns: [/\blinked ?in\b/],
  },
  {
    key: "github",
    patterns: [/\bgit ?hub\b/, /\bgit repo(sitory)?\b/, /\brepository url\b/, /\brepo url\b/, /\bsource code\b/],
  },
  {
    key: "logo",
    patterns: [/\blogo\b/, /\bicon\b/, /\bavatar\b/, /\bthumbnail\b/, /\bfavicon\b/, /\bbrand image\b/, /\bproduct image\b/],
    types: ["file"],
  },
];

function scoreRule(rule: Rule, signals: FieldSignals): number {
  let score = 0;

  for (const src of SOURCE_WEIGHTS) {
    const text = normalize(signals[src.key] as string | null | undefined);
    if (!text) continue;
    if (rule.patterns.some((re) => re.test(text))) score += src.weight;
    if (rule.negative?.some((re) => re.test(text))) score -= NEGATIVE_PENALTY;
  }

  const type = normalize(signals.type);
  if (rule.types && type && rule.types.includes(type)) score += TYPE_BONUS;

  const ac = normalize(signals.autocomplete);
  if (rule.autocomplete && ac && rule.autocomplete.some((a) => ac.includes(a))) {
    score += AUTOCOMPLETE_BONUS;
  }

  if (rule.prefersTextarea && normalize(signals.tagName) === "textarea") {
    score += TEXTAREA_BONUS;
  }

  return score;
}

/**
 * Classify a single field into its best canonical key, or null if nothing matches.
 * Conservative by design — a human reviews and submits, so we prefer leaving a
 * field unfilled (ambiguous) over filling it wrong.
 */
export function classifyField(signals: FieldSignals): Classification | null {
  const scored = RULES.map((r) => ({ key: r.key, score: scoreRule(r, signals) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const top = scored[0]!;
  const second = scored[1];

  const confidence: Confidence = top.score >= 2.0 ? "high" : top.score >= 1.0 ? "medium" : "low";
  const ambiguous = confidence === "low" || (second !== undefined && top.score - second.score < 0.5);

  return {
    key: top.key,
    score: round(top.score),
    confidence,
    ambiguous,
    alternatives: scored.slice(1, 4).map((s) => ({ key: s.key, score: round(s.score) })),
  };
}

/**
 * Whether a classification is confident enough to auto-fill without human prompting.
 * Returns a plain boolean (not a type guard) so callers can branch without the
 * negative narrowing collapsing the variable's type in the else branch.
 */
export function shouldFill(c: Classification | null): boolean {
  return c !== null && !c.ambiguous && c.confidence !== "low";
}

/** Classify a batch of fields (e.g. an entire form) in one call. */
export function classifyForm(fields: FieldSignals[]): Array<{
  signals: FieldSignals;
  classification: Classification | null;
}> {
  return fields.map((signals) => ({ signals, classification: classifyField(signals) }));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
