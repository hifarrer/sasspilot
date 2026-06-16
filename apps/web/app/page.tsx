import Link from "next/link";
import { getStats } from "@/lib/directories";

export default async function HomePage() {
  const stats = await getStats().catch(() => ({ total: 0, free: 0, dofollow: 0 }));

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col items-center gap-6 py-12 text-center">
        <span className="badge">1,000+ curated directories · human-submitted</span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Submit your startup everywhere — without filling the same form 1,000 times.
        </h1>
        <p className="max-w-2xl text-lg" style={{ color: "var(--text-muted)" }}>
          Browse a curated catalog of {stats.total.toLocaleString()} startup-submission sites ranked
          by Domain Rating, then let the browser extension pre-fill each form from one profile. You
          review and submit — always.
        </p>
        <div className="flex gap-3">
          <Link href="/directories" className="btn">
            Browse directories →
          </Link>
          <Link href="/extension" className="btn btn-ghost">
            Get the extension
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Curated directories", value: stats.total.toLocaleString() },
          { label: "Free to submit", value: stats.free.toLocaleString() },
          { label: "Dofollow backlinks", value: stats.dofollow.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="card p-6 text-center">
            <div className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
              {s.value}
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {[
          {
            title: "1 · Build your profile",
            body: "Enter your startup once — name, tagline, URL, descriptions. Or paste a URL and generate the copy with AI.",
          },
          {
            title: "2 · Pick directories",
            body: "Filter by category, Domain Rating, cost and backlink type. Track what you've submitted in your dashboard.",
          },
          {
            title: "3 · Pre-fill & submit",
            body: "Open a directory, click the extension, and it maps your profile onto that site's fields. You hit submit.",
          },
        ].map((c) => (
          <div key={c.title} className="card p-6">
            <h3 className="font-semibold">{c.title}</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {c.body}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
