import { fillFieldsInput } from "@aisas/shared";
import { NextResponse } from "next/server";
import { generateFieldValues, isAiConfigured } from "@/lib/anthropic";
import { getRequestUser } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Per-instance rate limit. For multi-instance production, back this with Redis/Upstash.
const RATE_WINDOW = 1000 * 60; // 1 min
const RATE_MAX = 10;
const rate = new Map<string, number[]>();

export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = fillFieldsInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const { profile, fields, model } = parsed.data;

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "ai_not_configured", message: "Set ANTHROPIC_API_KEY in apps/web/.env.local." },
      { status: 503 },
    );
  }

  if (fields.length === 0) {
    return NextResponse.json({ values: [] });
  }

  const now = Date.now();
  const recent = (rate.get(user.id) ?? []).filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_MAX) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  recent.push(now);
  rate.set(user.id, recent);

  try {
    const data = await generateFieldValues({ profile, fields, model });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "generation_failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
