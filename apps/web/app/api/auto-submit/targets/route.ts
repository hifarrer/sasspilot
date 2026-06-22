import { NextResponse } from "next/server";
import { guardAutoSubmit } from "@/lib/autoSubmitGuard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const directorySelect = {
  id: true,
  slug: true,
  name: true,
  domain: true,
  submissionUrl: true,
  cost: true,
  requiresLogin: true,
} as const;

type TargetRow = {
  directoryId: string;
  submitUrl: string | null;
  allowPaid: boolean;
  enabled: boolean;
  directory: {
    id: string;
    slug: string;
    name: string;
    domain: string;
    submissionUrl: string;
    cost: string;
    requiresLogin: boolean;
  };
};

function serialize(t: TargetRow) {
  return {
    directoryId: t.directoryId,
    submitUrl: t.submitUrl,
    allowPaid: t.allowPaid,
    enabled: t.enabled,
    directory: t.directory,
  };
}

/** List the user's auto-submit targets. */
export async function GET(req: Request) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  const targets = await db.autoSubmitTarget.findMany({
    where: { userId: g.userId },
    orderBy: { createdAt: "desc" },
    include: { directory: { select: directorySelect } },
  });
  return NextResponse.json({ targets: targets.map(serialize) });
}

/** Add (or update) a target directory. */
export async function POST(req: Request) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  const body = (await req.json().catch(() => null)) as {
    directoryId?: unknown;
    submitUrl?: unknown;
    allowPaid?: unknown;
  } | null;
  const directoryId = typeof body?.directoryId === "string" ? body.directoryId : null;
  if (!directoryId) return NextResponse.json({ error: "directoryId required" }, { status: 400 });

  const dir = await db.directory.findUnique({ where: { id: directoryId } });
  if (!dir) return NextResponse.json({ error: "directory_not_found" }, { status: 404 });

  const submitUrl =
    typeof body?.submitUrl === "string" && body.submitUrl.trim() ? body.submitUrl.trim() : null;
  const allowPaid = body?.allowPaid === true;

  const target = await db.autoSubmitTarget.upsert({
    where: { userId_directoryId: { userId: g.userId, directoryId } },
    create: { userId: g.userId, directoryId, submitUrl, allowPaid },
    update: { submitUrl, allowPaid },
    include: { directory: { select: directorySelect } },
  });
  return NextResponse.json({ target: serialize(target) }, { status: 201 });
}

/** Remove a target by ?directoryId=. */
export async function DELETE(req: Request) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  const directoryId = new URL(req.url).searchParams.get("directoryId");
  if (!directoryId) return NextResponse.json({ error: "directoryId required" }, { status: 400 });

  await db.autoSubmitTarget.deleteMany({ where: { userId: g.userId, directoryId } });
  return NextResponse.json({ ok: true });
}
