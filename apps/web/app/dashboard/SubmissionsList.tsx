"use client";

import Link from "next/link";
import { useState } from "react";

const STATUSES = ["not_started", "pending", "submitted", "published", "rejected"] as const;

interface Sub {
  id: string;
  profileId: string;
  directoryId: string;
  status: string;
  postUrl: string | null;
  directory: {
    slug: string;
    name: string;
    domain: string;
    domainRating: number | null;
    category: string | null;
  };
}

export function SubmissionsList({ initial }: { initial: Sub[] }) {
  const [subs, setSubs] = useState<Sub[]>(initial);

  async function setStatus(s: Sub, status: string) {
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directoryId: s.directoryId,
        profileId: s.profileId,
        status,
        postUrl: s.postUrl,
      }),
    });
    if (res.ok) {
      const { submission } = (await res.json()) as { submission: { status: string } };
      setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: submission.status } : x)));
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="font-semibold">Submission tracker</h2>
      {subs.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No submissions tracked yet. Use the extension&apos;s &quot;Mark submitted&quot; button while
          on a directory, and it&apos;ll show up here.
        </p>
      ) : (
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          {subs.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 py-2">
              <Link
                href={`/directories/${s.directory.slug}`}
                className="min-w-0 flex-1 truncate hover:underline"
              >
                {s.directory.name}
                <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {s.directory.domain}
                </span>
              </Link>
              <select
                className="select"
                value={s.status}
                onChange={(e) => setStatus(s, e.target.value)}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
