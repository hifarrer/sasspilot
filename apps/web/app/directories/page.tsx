import Link from "next/link";
import { DirectoryCard } from "@/app/components/DirectoryCard";
import {
  getCategoryFacets,
  listDirectories,
  listDirectoriesGrouped,
  type DirectoryQuery,
} from "@/lib/directories";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function buildQS(query: DirectoryQuery, page: number): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.category) p.set("category", query.category);
  if (query.cost) p.set("cost", query.cost);
  if (query.backlink) p.set("backlink", query.backlink);
  if (query.minDR) p.set("minDR", String(query.minDR));
  if (query.sort && query.sort !== "clakr") p.set("sort", query.sort);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function DirectoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const query: DirectoryQuery = {
    q: get("q") || undefined,
    category: get("category") || undefined,
    cost: get("cost") || undefined,
    backlink: get("backlink") || undefined,
    minDR: get("minDR") ? Number(get("minDR")) : undefined,
    sort: (get("sort") as DirectoryQuery["sort"]) || "clakr",
    page: get("page") ? Number(get("page")) : 1,
  };

  // The default "clakr" view groups sites into category sections like clakr.com.
  // Any explicit global sort (dr / name / rank) falls back to a flat, paginated list.
  const grouped = query.sort === "clakr";

  const [categories, flat, groupedData] = await Promise.all([
    getCategoryFacets(),
    grouped ? Promise.resolve(null) : listDirectories(query),
    grouped ? listDirectoriesGrouped(query) : Promise.resolve(null),
  ]);

  const total = grouped ? groupedData!.total : flat!.total;
  const sortLabel = grouped
    ? "Recommended — top picks first, grouped by category"
    : query.sort === "name"
      ? "name"
      : query.sort === "rank"
        ? "category rank"
        : "Domain Rating";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Directories</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {total.toLocaleString()} matching sites · sorted by {sortLabel}
          </p>
        </div>
        <Link href="/directories" className="text-sm hover:underline" style={{ color: "var(--accent)" }}>
          Reset filters
        </Link>
      </div>

      {/* Filters — a plain GET form so it works without client JS. */}
      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Search
          <input
            className="input"
            type="search"
            name="q"
            placeholder="name or domain…"
            defaultValue={query.q ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Category
          <select className="select" name="category" defaultValue={query.category ?? ""}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Cost
          <select className="select" name="cost" defaultValue={query.cost ?? ""}>
            <option value="">Any</option>
            <option value="free">Free</option>
            <option value="freemium">Freemium</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Backlink
          <select className="select" name="backlink" defaultValue={query.backlink ?? ""}>
            <option value="">Any</option>
            <option value="dofollow">Dofollow</option>
            <option value="nofollow">Nofollow</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Min DR
          <select className="select" name="minDR" defaultValue={query.minDR ? String(query.minDR) : ""}>
            <option value="">Any</option>
            <option value="50">50+</option>
            <option value="70">70+</option>
            <option value="80">80+</option>
            <option value="90">90+</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Sort
          <select className="select" name="sort" defaultValue={query.sort ?? "clakr"}>
            <option value="clakr">Recommended</option>
            <option value="dr">Domain Rating</option>
            <option value="name">Name</option>
            <option value="rank">Category rank</option>
          </select>
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      {total === 0 ? (
        <p className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
          No directories match these filters.
        </p>
      ) : grouped ? (
        // Clakr-style: one section per category, in clakr's curated order.
        <div className="flex flex-col gap-10">
          {groupedData!.groups.map((g) => (
            <section key={g.category} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-lg font-bold">{g.category}</h2>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {g.count} {g.count === 1 ? "site" : "sites"}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((d) => (
                  <DirectoryCard key={d.slug} directory={d} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {flat!.items.map((d) => (
              <DirectoryCard key={d.slug} directory={d} />
            ))}
          </div>

          {flat!.pages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 text-sm">
              {flat!.page > 1 ? (
                <Link className="btn btn-ghost" href={`/directories${buildQS(query, flat!.page - 1)}`}>
                  ← Prev
                </Link>
              ) : (
                <span className="btn btn-ghost opacity-40">← Prev</span>
              )}
              <span style={{ color: "var(--text-muted)" }}>
                Page {flat!.page} of {flat!.pages}
              </span>
              {flat!.page < flat!.pages ? (
                <Link className="btn btn-ghost" href={`/directories${buildQS(query, flat!.page + 1)}`}>
                  Next →
                </Link>
              ) : (
                <span className="btn btn-ghost opacity-40">Next →</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
