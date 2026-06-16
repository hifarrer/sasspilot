import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Revoke a token. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const token = await db.apiToken.findUnique({ where: { id } });
  if (!token || token.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.apiToken.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
