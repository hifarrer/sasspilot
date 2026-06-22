"use client";

import { useEffect, useState } from "react";

interface DirectoryLite {
  id: string;
  slug: string;
  name: string;
  domain: string;
  submissionUrl: string;
  cost: string;
  requiresLogin: boolean;
}
interface Target {
  directoryId: string;
  submitUrl: string | null;
  allowPaid: boolean;
  enabled: boolean;
  directory: DirectoryLite;
}
interface ProfileLite {
  id: string;
  startupName: string;
}
interface SiteResultLite {
  slug: string;
  submitOutcome: string;
  tier: string;
  blocker: string | null;
  screenshot: string | null;
  note?: string;
  fields: { action: string }[];
}
interface SiteProgress {
  slug: string;
  state: "pending" | "running" | "done";
  result?: SiteResultLite;
}
interface Job {
  id: string;
  type: "login" | "run";
  status: "running" | "awaiting-finish" | "done" | "error";
  mode?: string;
  stamp?: string;
  sites: SiteProgress[];
  logs: string[];
  error?: string;
}

const muted = { color: "var(--text-muted)" };

export function AutoSubmitTool({
  profiles,
  initialTargets,
}: {
  profiles: ProfileLite[];
  initialTargets: Target[];
}) {
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Restore any in-flight job on mount.
  useEffect(() => {
    fetch("/api/auto-submit/jobs")
      .then((r) => r.json())
      .then((d) => d.job && setJob(d.job))
      .catch(() => {});
  }, []);

  // Poll while a run is active.
  const polling = job?.type === "run" && job.status === "running";
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(async () => {
      try {
        const d = await (await fetch("/api/auto-submit/jobs")).json();
        setJob(d.job ?? null);
      } catch {
        /* ignore transient poll errors */
      }
    }, 1500);
    return () => clearInterval(id);
  }, [polling]);

  // Debounced directory search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const d = await (
          await fetch(`/api/directories?q=${encodeURIComponent(q)}&pageSize=8`)
        ).json();
        setResults((d.items ?? []) as DirectoryLite[]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addedIds = new Set(targets.map((t) => t.directoryId));

  async function addTarget(d: DirectoryLite) {
    setNote(null);
    const r = await fetch("/api/auto-submit/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryId: d.id }),
    });
    if (!r.ok) {
      setNote("Couldn't add that site.");
      return;
    }
    const { target } = (await r.json()) as { target: Target };
    setTargets((prev) => [target, ...prev.filter((t) => t.directoryId !== target.directoryId)]);
  }

  async function removeTarget(directoryId: string) {
    const r = await fetch(`/api/auto-submit/targets?directoryId=${encodeURIComponent(directoryId)}`, {
      method: "DELETE",
    });
    if (r.ok) setTargets((prev) => prev.filter((t) => t.directoryId !== directoryId));
  }

  async function saveUrl(directoryId: string) {
    setNote(null);
    const submitUrl = editValue.trim();
    const r = await fetch("/api/auto-submit/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryId, submitUrl: submitUrl || null }),
    });
    if (!r.ok) {
      setNote("Couldn't save the URL.");
      return;
    }
    const { target } = (await r.json()) as { target: Target };
    setTargets((prev) => prev.map((t) => (t.directoryId === directoryId ? target : t)));
    setEditing(null);
  }

  function isHomepageUrl(url: string): boolean {
    try {
      return new URL(url).pathname.replace(/\/+$/, "") === "";
    } catch {
      return false;
    }
  }

  function describeError(error: string | undefined): string {
    if (error === "no_targets") return "Add some sites first.";
    if (error === "busy") return "A job is already running — wait for it to finish.";
    return "Something went wrong.";
  }

  async function startLogin() {
    setBusy("login");
    setNote(null);
    try {
      const r = await fetch("/api/auto-submit/login/start", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setNote(describeError(d.error));
        return;
      }
      setJob(d.job);
      setNote('A browser window opened on your machine. Sign into each site, then click "I\'m done".');
    } finally {
      setBusy(null);
    }
  }

  async function finishLogin() {
    setBusy("finish");
    try {
      await fetch("/api/auto-submit/login/finish", { method: "POST" });
      setJob(null);
      setNote("Sessions saved. You can run a dry run now.");
    } finally {
      setBusy(null);
    }
  }

  async function runDryRun() {
    if (!profileId) {
      setNote("Pick a startup profile first.");
      return;
    }
    setBusy("run");
    setNote(null);
    try {
      const r = await fetch("/api/auto-submit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setNote(describeError(d.error));
        return;
      }
      setJob(d.job);
    } finally {
      setBusy(null);
    }
  }

  const loginAwaiting = job?.type === "login" && job.status === "awaiting-finish";
  const runJob = job?.type === "run" ? job : null;
  const anyBusy = busy !== null || polling;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Auto-submit</h1>
        <div
          className="badge"
          style={{ alignSelf: "flex-start", borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          ⚠ Runs locally only — opens a real browser on this machine
        </div>
      </div>

      {note && (
        <div className="card p-4 text-sm" style={{ borderColor: "var(--accent)" }}>
          {note}
        </div>
      )}

      {/* 1 — Profile + dry run */}
      <div className="card flex flex-col gap-3 p-6">
        <h2 className="font-semibold">1. Pick your startup & dry run</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs" style={muted}>
            Startup profile
            <select
              className="select"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              {profiles.length === 0 && <option value="">No profiles — create one first</option>}
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.startupName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            type="button"
            onClick={runDryRun}
            disabled={anyBusy || targets.length === 0 || !profileId}
          >
            {polling ? "Running…" : "Run dry run"}
          </button>
          <span className="text-xs" style={muted}>
            Fills forms + screenshots. Never submits, never writes to your CRM.
          </span>
        </div>
      </div>

      {/* 2 — Targets */}
      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-semibold">2. Test sites ({targets.length})</h2>
        <div className="flex flex-col gap-2">
          <input
            className="input"
            placeholder="Search directories by name or domain…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && (
            <div className="flex flex-col gap-1 text-sm">
              {searching && <span style={muted}>Searching…</span>}
              {!searching && results.length === 0 && <span style={muted}>No matches.</span>}
              {results.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <span>
                    {d.name}{" "}
                    <span className="text-xs" style={muted}>
                      {d.domain}
                    </span>
                  </span>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={addedIds.has(d.id)}
                    onClick={() => addTarget(d)}
                  >
                    {addedIds.has(d.id) ? "Added" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {targets.length === 0 ? (
          <p className="text-sm" style={muted}>
            No sites yet. Search above and add a few you have accounts on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {targets.map((t) => {
              const effectiveUrl = t.submitUrl ?? t.directory.submissionUrl;
              const homepage = !t.submitUrl && isHomepageUrl(effectiveUrl);
              return (
                <li
                  key={t.directoryId}
                  className="flex flex-col gap-2 rounded-lg p-3"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex flex-wrap items-center gap-2">
                      {t.directory.name}
                      <span className="text-xs" style={muted}>
                        {t.directory.domain}
                      </span>
                      {t.directory.cost === "paid" && <span className="badge">paid</span>}
                      {homepage && (
                        <span
                          className="badge"
                          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                        >
                          homepage — set the real submit URL
                        </span>
                      )}
                    </span>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => removeTarget(t.directoryId)}
                    >
                      Remove
                    </button>
                  </div>
                  {editing === t.directoryId ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="input"
                        style={{ flex: 1 }}
                        value={editValue}
                        placeholder="https://site.com/submit"
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                      <button className="btn" type="button" onClick={() => saveUrl(t.directoryId)}>
                        Save
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-xs" style={muted}>
                      <span
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {effectiveUrl}
                      </span>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setEditing(t.directoryId);
                          setEditValue(t.submitUrl ?? t.directory.submissionUrl);
                        }}
                      >
                        Edit URL
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 3 — Login */}
      <div className="card flex flex-col gap-3 p-6">
        <h2 className="font-semibold">3. Log in to your sites (once)</h2>
        <p className="text-sm" style={muted}>
          Opens a browser with a tab per site. Sign into each, then click “I’m done” — your sessions
          are saved locally and reused on every run.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn"
            type="button"
            onClick={startLogin}
            disabled={anyBusy || targets.length === 0}
          >
            {busy === "login" ? "Opening…" : "Log in to sites"}
          </button>
          {loginAwaiting && (
            <button className="btn btn-ghost" type="button" onClick={finishLogin} disabled={busy === "finish"}>
              {busy === "finish" ? "Saving…" : "I'm done"}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {runJob && (
        <div className="card flex flex-col gap-3 p-6">
          <h2 className="font-semibold">
            Dry run {runJob.status === "running" ? "— in progress…" : runJob.status === "error" ? "— failed" : "— complete"}
          </h2>
          {runJob.error && (
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              {runJob.error}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {runJob.sites.map((s) => (
              <div
                key={s.slug}
                className="flex flex-col gap-2 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{s.slug}</span>
                  <div className="flex flex-wrap items-center gap-2 text-xs" style={muted}>
                    <span className="badge">{s.result?.submitOutcome ?? s.state}</span>
                    {s.result && (
                      <>
                        <span>{s.result.fields.filter((f) => f.action === "filled").length} filled</span>
                        <span>tier: {s.result.tier}</span>
                        {s.result.blocker && <span className="badge">{s.result.blocker}</span>}
                        {s.result.note && <span>{s.result.note}</span>}
                      </>
                    )}
                    {!s.result && s.state === "running" && <span>running…</span>}
                  </div>
                </div>
                {s.result?.screenshot && runJob.stamp && (
                  <a
                    href={`/api/auto-submit/screenshots/${runJob.stamp}/${s.result.screenshot}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`${s.slug} screenshot`}
                      src={`/api/auto-submit/screenshots/${runJob.stamp}/${s.result.screenshot}`}
                      style={{
                        width: 160,
                        height: 100,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    />
                  </a>
                )}
              </div>
            ))}
          </div>
          {runJob.logs.length > 0 && (
            <pre
              className="overflow-auto rounded-lg p-3 text-xs"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", maxHeight: 200 }}
            >
              {runJob.logs.join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
