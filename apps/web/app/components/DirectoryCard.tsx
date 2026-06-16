import Link from "next/link";
import { BacklinkBadge, CostBadge, DrBadge } from "./Badges";

interface Props {
  directory: {
    slug: string;
    name: string;
    domain: string;
    domainRating: number | null;
    category: string | null;
    cost: string;
    backlinkType: string;
    knownFor: string | null;
    editorsPick: boolean;
  };
}

export function DirectoryCard({ directory: d }: Props) {
  return (
    <Link
      href={`/directories/${d.slug}`}
      className="card flex flex-col gap-3 p-4 transition-colors hover:border-[var(--accent)]"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=64`}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          className="mt-0.5 rounded"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{d.name}</h3>
            {d.editorsPick && <span title="Editor's pick">★</span>}
          </div>
          <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {d.domain}
          </div>
        </div>
        <DrBadge dr={d.domainRating} />
      </div>

      {d.knownFor && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {d.knownFor}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <CostBadge cost={d.cost} />
        <BacklinkBadge type={d.backlinkType} />
        {d.category && <span className="badge">{d.category}</span>}
      </div>
    </Link>
  );
}
