import Link from "next/link";
import { getSessionUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { toStartupProfile } from "@/lib/profiles";
import { ProfileEditor } from "./ProfileEditor";
import { SubmissionsList } from "./SubmissionsList";
import { TokenManager } from "./TokenManager";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="card p-6">
          <p className="mb-3" style={{ color: "var(--text-muted)" }}>
            Sign in to save startup profiles and track your submissions across directories.
          </p>
          <Link href="/signin" className="btn">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const [profilesRaw, submissionsRaw, tokensRaw] = await Promise.all([
    db.profile.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    db.submission.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        directory: {
          select: { slug: true, name: true, domain: true, domainRating: true, category: true },
        },
      },
    }),
    db.apiToken.findMany({
      where: { userId: user.id },
      select: { id: true, label: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const profiles = profilesRaw.map(toStartupProfile);
  const submissions = submissionsRaw.map((s) => ({
    id: s.id,
    profileId: s.profileId,
    directoryId: s.directoryId,
    status: s.status,
    postUrl: s.postUrl,
    directory: s.directory,
  }));
  const tokens = tokensRaw.map((t) => ({
    id: t.id,
    label: t.label,
    lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <ProfileEditor initial={profiles} />
      <SubmissionsList initial={submissions} />
      <TokenManager initial={tokens} />
    </div>
  );
}
