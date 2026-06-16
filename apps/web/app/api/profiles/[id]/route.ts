import { profileInput } from "@aisas/shared";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { toProfileData, toStartupProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

async function ownProfileOr404(userId: string, id: string) {
  const profile = await db.profile.findUnique({ where: { id } });
  if (!profile || profile.userId !== userId) return null;
  return profile;
}

/** Update a startup profile. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ownProfileOr404(user.id, id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = profileInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  const profile = await db.profile.update({ where: { id }, data: toProfileData(parsed.data) });
  return NextResponse.json({ profile: toStartupProfile(profile) });
}

/** Delete a startup profile. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ownProfileOr404(user.id, id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.profile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
