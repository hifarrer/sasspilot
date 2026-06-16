import { generateDescriptionInput, type GenerateDescriptionOutput } from "@aisas/shared";
import { NextResponse } from "next/server";
import { generateCopy, isAiConfigured } from "@/lib/anthropic";
import { getRequestUser } from "@/lib/authz";
import { fetchPageText } from "@/lib/pageText";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Simple per-instance rate limit + cache. For multi-instance production, back
// these with Redis/Upstash instead.
const CACHE_TTL = 1000 * 60 * 30; // 30 min
const RATE_WINDOW = 1000 * 60; // 1 min
const RATE_MAX = 10;
const cache = new Map<string, { at: number; data: GenerateDescriptionOutput }>();
const rate = new Map<string, number[]>();

export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = generateDescriptionInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const { url, model } = parsed.data;

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "ai_not_configured", message: "Set ANTHROPIC_API_KEY in apps/web/.env.local." },
      { status: 503 },
    );
  }

  const now = Date.now();
  const recent = (rate.get(user.id) ?? []).filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_MAX) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  recent.push(now);
  rate.set(user.id, recent);

  const key = `${model ?? "default"}:${url}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL) return NextResponse.json(hit.data);

  try {
    const page = await fetchPageText(url);
    const pageText = [page.title, page.description, page.text].filter(Boolean).join("\n");
    const data = await generateCopy({ url, pageText, model });
    cache.set(key, { at: now, data });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "generation_failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
