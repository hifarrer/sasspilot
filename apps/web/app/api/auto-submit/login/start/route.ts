import { NextResponse } from "next/server";
import { guardAutoSubmit } from "@/lib/autoSubmitGuard";
import { JobBusyError, startLogin } from "@/lib/autoSubmitJobs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Open a local headed browser with a tab per enabled target so the user can sign in. */
export async function POST(req: Request) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  const targets = await db.autoSubmitTarget.findMany({
    where: { userId: g.userId, enabled: true },
    include: { directory: { select: { slug: true, name: true, domain: true, submissionUrl: true } } },
  });
  const loginTargets = targets
    .map((t) => ({
      slug: t.directory.slug,
      name: t.directory.name,
      url: t.submitUrl ?? t.directory.submissionUrl,
    }))
    .filter((t) => Boolean(t.url));
  if (loginTargets.length === 0) {
    return NextResponse.json({ error: "no_targets" }, { status: 400 });
  }

  try {
    const job = await startLogin(loginTargets);
    return NextResponse.json({ job });
  } catch (e) {
    if (e instanceof JobBusyError) return NextResponse.json({ error: "busy" }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
