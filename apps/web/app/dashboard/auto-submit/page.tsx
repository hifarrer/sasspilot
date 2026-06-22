import Link from "next/link";
import { isAutoSubmitEnabled } from "@/lib/autoSubmitEnabled";
import { getSessionUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { AutoSubmitTool } from "./AutoSubmitTool";

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

export default async function AutoSubmitPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Auto-submit</h1>
        <div className="card p-6">
          <p className="mb-3" style={{ color: "var(--text-muted)" }}>
            Sign in to use the auto-submit tool.
          </p>
          <Link href="/signin" className="btn">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!isAutoSubmitEnabled()) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Auto-submit</h1>
        <div className="card flex flex-col gap-2 p-6">
          <p className="font-semibold">⚠ This tool only runs locally</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Auto-submit opens a real browser on your own machine, so it only works when you run the
            app locally (<code>pnpm web</code>) with <code>AUTOSUBMIT_ENABLED=true</code> in
            <code> apps/web/.env</code>. It is intentionally disabled on the hosted site.
          </p>
        </div>
      </div>
    );
  }

  const [profiles, targetsRaw] = await Promise.all([
    db.profile.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, startupName: true },
    }),
    db.autoSubmitTarget.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { directory: { select: directorySelect } },
    }),
  ]);

  const targets = targetsRaw.map((t) => ({
    directoryId: t.directoryId,
    submitUrl: t.submitUrl,
    allowPaid: t.allowPaid,
    enabled: t.enabled,
    directory: t.directory,
  }));

  return <AutoSubmitTool profiles={profiles} initialTargets={targets} />;
}
