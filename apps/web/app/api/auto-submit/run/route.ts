import { NextResponse } from "next/server";
import { guardAutoSubmit } from "@/lib/autoSubmitGuard";
import { JobBusyError, startRun } from "@/lib/autoSubmitJobs";
import { db } from "@/lib/db";
import { getFieldMapByDomain } from "@/lib/fieldMaps";
import { toStartupProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

/** Start a dry-run over the user's enabled targets. Returns immediately; client polls /jobs. */
export async function POST(req: Request) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  const body = (await req.json().catch(() => null)) as { profileId?: unknown } | null;
  const profileId = typeof body?.profileId === "string" ? body.profileId : null;
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const profileRow = await db.profile.findUnique({ where: { id: profileId } });
  if (!profileRow || profileRow.userId !== g.userId) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const targets = await db.autoSubmitTarget.findMany({
    where: { userId: g.userId, enabled: true },
    include: { directory: { select: { id: true, slug: true, domain: true, submissionUrl: true, cost: true } } },
  });
  const sites = targets
    .filter((t) => !(t.directory.cost === "paid" && !t.allowPaid))
    .map((t) => ({
      directory: { id: t.directory.id, slug: t.directory.slug, domain: t.directory.domain },
      url: t.submitUrl ?? t.directory.submissionUrl,
    }))
    .filter((s) => Boolean(s.url));
  if (sites.length === 0) return NextResponse.json({ error: "no_targets" }, { status: 400 });

  try {
    const job = startRun({
      profile: toStartupProfile(profileRow),
      sites,
      mode: "dry-run",
      getFieldMap: (domain) => getFieldMapByDomain(domain),
    });
    return NextResponse.json({ job });
  } catch (e) {
    if (e instanceof JobBusyError) return NextResponse.json({ error: "busy" }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
