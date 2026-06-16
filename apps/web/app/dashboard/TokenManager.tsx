"use client";

import { useState } from "react";

interface TokenMeta {
  id: string;
  label: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function TokenManager({ initial }: { initial: TokenMeta[] }) {
  const [tokens, setTokens] = useState<TokenMeta[]>(initial);
  const [label, setLabel] = useState("My browser");
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setPlaintext(null);
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setBusy(false);
    if (!res.ok) return;
    const data = (await res.json()) as { token: string; id: string; label: string; createdAt: string };
    setPlaintext(data.token);
    setTokens((prev) => [
      { id: data.id, label: data.label, lastUsedAt: null, createdAt: data.createdAt },
      ...prev,
    ]);
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    if (res.ok) setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-semibold">Extension token</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Generate a token and paste it into the browser extension&apos;s settings to sync your
          profiles and submissions.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Label
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <button className="btn" onClick={create} disabled={busy} type="button">
          {busy ? "Generating…" : "Generate token"}
        </button>
      </div>

      {plaintext && (
        <div
          className="flex flex-col gap-1 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <span style={{ color: "var(--text-muted)" }}>
            Copy this now — it won&apos;t be shown again:
          </span>
          <code className="break-all" style={{ color: "var(--accent)" }}>
            {plaintext}
          </code>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3">
              <span>
                {t.label}
                <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
                </span>
              </span>
              <button className="btn btn-ghost" onClick={() => revoke(t.id)} type="button">
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
