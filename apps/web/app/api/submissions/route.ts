import { submissionInput } from "@aisas/shared";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** List the current user's submissions (optionally filtered by ?profileId=). */
export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profileId = new URL(req.url).searchParams.get("profileId") ?? undefined;
  const submissions = await db.submission.findMany({
    where: { userId: user.id, ...(profileId ? { profileId } : {}) },
    orderBy: { updatedAt: "desc" },
    include: {
      directory: {
        select: { slug: true, name: true, domain: true, domainRating: true, category: true },
      },
    },
  });
  return NextResponse.json({ submissions });
}

/** Upsert a submission (unique per profile+directory) and stamp status transitions. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = submissionInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const { directoryId, profileId, status, postUrl, notes } = parsed.data;

  // Ownership / existence checks.
  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.userId !== user.id) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  const directory = await db.directory.findUnique({ where: { id: directoryId } });
  if (!directory) return NextResponse.json({ error: "directory_not_found" }, { status: 404 });

  const now = new Date();
  const submittedAt = status === "submitted" || status === "published" ? now : null;
  const publishedAt = status === "published" ? now : null;

  const submission = await db.submission.upsert({
    where: { profileId_directoryId: { profileId, directoryId } },
    create: {
      userId: user.id,
      profileId,
      directoryId,
      status,
      postUrl: postUrl ?? null,
      notes: notes ?? null,
      submittedAt,
      publishedAt,
    },
    update: {
      status,
      postUrl: postUrl ?? null,
      notes: notes ?? null,
      // Preserve the first submit/publish timestamp; only set when reaching that state.
      ...(submittedAt ? { submittedAt } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    },
  });
  return NextResponse.json({ submission });
}
