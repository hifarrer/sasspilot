import { profileInput } from "@aisas/shared";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { toProfileData, toStartupProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

/** List the current user's startup profiles. */
export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profiles = await db.profile.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ profiles: profiles.map(toStartupProfile) });
}

/** Create a startup profile. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = profileInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  const profile = await db.profile.create({
    data: { userId: user.id, ...toProfileData(parsed.data) },
  });
  return NextResponse.json({ profile: toStartupProfile(profile) }, { status: 201 });
}
