"use client";

import type { StartupProfile } from "@aisas/shared";
import { useState } from "react";

const BLANK = {
  startupName: "",
  tagline: "",
  shortDescription: "",
  longDescription: "",
  websiteUrl: "",
  contactEmail: "",
  founderName: "",
  category: "",
  pricingModel: "",
  twitter: "",
  linkedin: "",
  github: "",
  logoUrl: "",
};
type FormState = typeof BLANK;

function toForm(p: StartupProfile): FormState {
  return {
    startupName: p.startupName,
    tagline: p.tagline,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    websiteUrl: p.websiteUrl,
    contactEmail: p.contactEmail,
    founderName: p.founderName,
    category: p.category ?? "",
    pricingModel: p.pricingModel ?? "",
    twitter: p.twitter ?? "",
    linkedin: p.linkedin ?? "",
    github: p.github ?? "",
    logoUrl: p.logoUrl ?? "",
  };
}

const TEXT_FIELDS: Array<[keyof FormState, string, string?]> = [
  ["startupName", "Startup / product name"],
  ["tagline", "Tagline"],
  ["websiteUrl", "Website URL", "url"],
  ["contactEmail", "Contact email", "email"],
  ["founderName", "Your name (founder)"],
  ["category", "Category"],
  ["pricingModel", "Pricing model"],
  ["twitter", "Twitter / X"],
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
  ["logoUrl", "Logo URL", "url"],
];

export function ProfileEditor({ initial }: { initial: StartupProfile[] }) {
  const [profiles, setProfiles] = useState<StartupProfile[]>(initial);
  const [selectedId, setSelectedId] = useState<string>(initial[0]?.id ?? "new");
  const [form, setForm] = useState<FormState>(initial[0] ? toForm(initial[0]) : BLANK);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function select(id: string) {
    setSelectedId(id);
    const p = profiles.find((x) => x.id === id);
    setForm(p ? toForm(p) : BLANK);
    setMsg(null);
  }
  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const isNew = selectedId === "new";
    const res = await fetch(isNew ? "/api/profiles" : `/api/profiles/${selectedId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, screenshots: [] }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg("Save failed — a valid name is required.");
      return;
    }
    const { profile } = (await res.json()) as { profile: StartupProfile };
    setProfiles((prev) =>
      isNew ? [profile, ...prev] : prev.map((p) => (p.id === profile.id ? profile : p)),
    );
    setSelectedId(profile.id);
    setMsg("Saved.");
  }

  async function remove() {
    if (selectedId === "new") return;
    if (!confirm("Delete this profile?")) return;
    const res = await fetch(`/api/profiles/${selectedId}`, { method: "DELETE" });
    if (res.ok) {
      const id = selectedId;
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      select("new");
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Startup profiles</h2>
        <select className="select" value={selectedId} onChange={(e) => select(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.startupName || "(untitled)"}
            </option>
          ))}
          <option value="new">+ New profile</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TEXT_FIELDS.map(([key, label, type]) => (
          <label key={key} className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {label}
            <input
              className="input"
              type={type ?? "text"}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
        Short description
        <textarea
          className="input"
          rows={2}
          value={form.shortDescription}
          onChange={(e) => set("shortDescription", e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
        Long description
        <textarea
          className="input"
          rows={4}
          value={form.longDescription}
          onChange={(e) => set("longDescription", e.target.value)}
        />
      </label>

      <div className="flex items-center gap-3">
        <button className="btn" onClick={save} disabled={saving} type="button">
          {saving ? "Saving…" : selectedId === "new" ? "Create profile" : "Save changes"}
        </button>
        {selectedId !== "new" && (
          <button className="btn btn-ghost" onClick={remove} type="button">
            Delete
          </button>
        )}
        {msg && (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
