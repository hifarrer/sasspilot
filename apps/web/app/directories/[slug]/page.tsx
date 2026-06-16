import Link from "next/link";
import { notFound } from "next/navigation";
import { BacklinkBadge, CostBadge, DrBadge } from "@/app/components/Badges";
import { getDirectory } from "@/lib/directories";

export const dynamic = "force-dynamic";

export default async function DirectoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getDirectory(slug);
  if (!d) notFound();

  const steps = [
    `Open ${d.domain} and find the submit / "add your product" page (create an account if required).`,
    "Open the SAASpilot extension and pick your startup profile.",
    'Click "Fill this page" — the extension maps your profile onto this site\'s fields.',
    "Review every field, then submit. Mark it Submitted in your dashboard and save the live link.",
  ];

  return (
    <div className="flex flex-col gap-8">
      <Link href="/directories" className="text-sm hover:underline" style={{ color: "var(--accent)" }}>
        ← All directories
      </Link>

      <header className="card flex flex-wrap items-center gap-4 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=128`}
          alt=""
          width={48}
          height={48}
          className="rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{d.name}</h1>
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            {d.domain}
            {d.category ? ` · ${d.category}` : ""}
          </div>
        </div>
        <a className="btn" href={d.submissionUrl} target="_blank" rel="noopener noreferrer">
          Visit & submit ↗
        </a>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Domain Rating" value={<DrBadge dr={d.domainRating} />} />
        <Stat
          label="Category rank"
          value={d.categoryRank ? `#${d.categoryRank}${d.categorySize ? ` / ${d.categorySize}` : ""}` : "—"}
        />
        <Stat label="Cost" value={<CostBadge cost={d.cost} />} />
        <Stat label="Backlink" value={d.backlinkType === "none" ? "—" : <BacklinkBadge type={d.backlinkType} />} />
      </section>

      {(d.knownFor || d.description) && (
        <section className="card p-6">
          <h2 className="mb-2 font-semibold">About</h2>
          {d.knownFor && (
            <p className="mb-2">
              <span style={{ color: "var(--text-muted)" }}>Known for: </span>
              {d.knownFor}
            </p>
          )}
          {d.description && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {d.description}
            </p>
          )}
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-3 font-semibold">How to submit</h2>
        <ol className="flex flex-col gap-2 text-sm">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}
              >
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {d.lastVerifiedAt && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Domain Rating last verified {new Date(d.lastVerifiedAt).toLocaleDateString()} (Ahrefs).
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
