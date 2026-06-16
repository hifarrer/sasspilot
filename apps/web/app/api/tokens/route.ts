import { tokenInput } from "@aisas/shared";
import { NextResponse } from "next/server";
import { generateToken, getSessionUser } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** List the current user's tokens (metadata only — never the secret). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tokens = await db.apiToken.findMany({
    where: { userId: user.id },
    select: { id: true, label: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tokens });
}

/** Mint a new extension token. The plaintext is returned exactly once. */
export async function POST(req: Request) {
  // Session-only: tokens must not be mintable with a token.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = tokenInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  const { token, hash } = generateToken();
  const rec = await db.apiToken.create({
    data: { userId: user.id, tokenHash: hash, label: parsed.data.label },
    select: { id: true, label: true, createdAt: true },
  });
  return NextResponse.json({ token, ...rec }, { status: 201 });
}
