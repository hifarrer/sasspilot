import type { StartupProfile } from "@aisas/shared/types";
import { useEffect, useState } from "react";
import {
  createProfile,
  fetchFieldMap,
  fetchProfiles,
  findDirectoryByDomain,
  generateDescription,
  markSubmitted,
  updateProfile,
} from "../lib/api";
import { connectAccount } from "../lib/auth";
import { APP_URL } from "../lib/config";
import type { FillResult } from "../lib/messages";
import {
  DEFAULT_SETTINGS,
  getProfiles,
  getSettings,
  type Settings,
  setProfiles as saveProfiles,
  setSettings as saveSettings,
} from "../lib/storage";

// A blank, unsaved profile. id "new" routes Save to POST (create) instead of PATCH.
const NEW_DRAFT: StartupProfile = {
  id: "new",
  startupName: "",
  tagline: "",
  shortDescription: "",
  longDescription: "",
  websiteUrl: "",
  contactEmail: "",
  founderName: "",
  logoUrl: null,
  screenshots: [],
  category: null,
  pricingModel: null,
  twitter: null,
  linkedin: null,
  github: null,
};

type Note = { kind: "ok" | "warn"; text: string } | null;

const TEXT_FIELDS: Array<[keyof StartupProfile, string, string?]> = [
  ["startupName", "Startup / product name"],
  ["tagline", "Tagline"],
  ["websiteUrl", "Website URL", "url"],
  ["contactEmail", "Contact email", "email"],
  ["founderName", "Your name"],
  ["category", "Category"],
  ["twitter", "Twitter / X"],
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
];

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<StartupProfile[]>([]);
  const [activeId, setActiveId] = useState<string>("new");
  const [showAccount, setShowAccount] = useState(false);
  const [genUrl, setGenUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [result, setResult] = useState<FillResult | null>(null);

  const signedIn = !!settings.token;

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setSettings(s);
      if (!s.token) return; // signed out: nothing to load

      const stored = await getProfiles();
      const list = stored.length ? stored : [NEW_DRAFT];
      setProfiles(list);
      const id =
        s.activeProfileId && list.some((p) => p.id === s.activeProfileId)
          ? s.activeProfileId
          : list[0]!.id;
      setActiveId(id);

      // Auto-sync: the dashboard is the source of truth. Pull silently on open — but not
      // while there are unsaved local edits, which `dirty` guards from being clobbered.
      if (!s.dirty) void onSync(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? NEW_DRAFT;

  async function persist(next: StartupProfile[]) {
    setProfiles(next);
    await saveProfiles(next);
  }
  async function markDirty(dirty: boolean) {
    setSettings(await saveSettings({ dirty }));
  }
  function update<K extends keyof StartupProfile>(key: K, value: StartupProfile[K]) {
    void persist(profiles.map((p) => (p.id === active.id ? { ...p, [key]: value } : p)));
    void markDirty(true);
  }
  async function chooseActive(id: string) {
    setActiveId(id);
    setSettings(await saveSettings({ activeProfileId: id }));
  }

  function onSelectProfile(id: string) {
    if (id === "new") return void onNewProfile();
    void chooseActive(id);
  }

  async function onNewProfile() {
    await persist([{ ...NEW_DRAFT }, ...profiles.filter((p) => p.id !== "new")]);
    await chooseActive("new");
    await markDirty(true);
    setNote(null);
  }

  // `silent` is used by auto-sync on open: no spinner, no notes, the active profile is
  // preserved, and unsaved edits are left untouched (guarded by the dirty flag).
  async function onSync(silent = false) {
    if (silent && settings.dirty) return;
    if (!silent) {
      setBusy("sync");
      setNote(null);
    }
    try {
      const fetched = await fetchProfiles();
      if (!fetched.length) {
        await persist([{ ...NEW_DRAFT }]);
        setActiveId("new");
        if (!silent) {
          await markDirty(false);
          setNote({ kind: "warn", text: "No profiles yet — fill one in and Save." });
        }
        return;
      }
      await persist(fetched);
      setActiveId((cur) => (fetched.some((p) => p.id === cur) ? cur : fetched[0]!.id));
      if (!silent) {
        await markDirty(false);
        setNote({ kind: "ok", text: `Synced ${fetched.length} profile(s).` });
      }
    } catch (e) {
      if (!silent) setNote({ kind: "warn", text: (e as Error).message });
    } finally {
      if (!silent) setBusy(null);
    }
  }

  async function onSignIn() {
    setBusy("auth");
    setNote(null);
    try {
      const token = await connectAccount();
      // Start clean: never let a previous account's cached profiles or unsaved flag carry
      // over (saving another user's profile id would 404). The fresh sync repopulates.
      await saveProfiles([]);
      setProfiles([]);
      setActiveId("new");
      setSettings(await saveSettings({ token, activeProfileId: null, dirty: false }));
      await onSync();
    } catch (e) {
      setNote({ kind: "warn", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function onSignOut() {
    setShowAccount(false);
    setResult(null);
    setNote(null);
    await saveProfiles([]);
    setProfiles([]);
    setActiveId("new");
    setSettings(await saveSettings({ token: "", activeProfileId: null, dirty: false }));
  }

  async function onSave() {
    if (!active.startupName.trim()) {
      setNote({ kind: "warn", text: "Add a startup name first." });
      return;
    }
    setBusy("save");
    setNote(null);
    try {
      const isNew = active.id === "new";
      const saved = isNew ? await createProfile(active) : await updateProfile(active.id, active);
      const next = isNew
        ? [saved, ...profiles.filter((p) => p.id !== "new")]
        : profiles.map((p) => (p.id === saved.id ? saved : p));
      await persist(next);
      await chooseActive(saved.id);
      await markDirty(false);
      setNote({ kind: "ok", text: "Saved." });
    } catch (e) {
      const msg = (e as Error).message;
      // 404 means this profile id isn't on the signed-in account (stale/cross-user cache).
      // Drop the local edits and re-pull so the list matches the current account.
      if (msg === "not_found") {
        setNote({ kind: "warn", text: "That profile isn't on your account — refreshed your list." });
        await markDirty(false);
        await onSync();
      } else {
        setNote({ kind: "warn", text: msg });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDiscard() {
    await markDirty(false);
    await onSync();
  }

  async function onGenerate() {
    const url = genUrl || active.websiteUrl;
    if (!url) {
      setNote({ kind: "warn", text: "Enter a URL to generate from." });
      return;
    }
    setBusy("gen");
    setNote(null);
    try {
      const copy = await generateDescription(url);
      await persist(
        profiles.map((p) =>
          p.id === active.id
            ? {
                ...p,
                tagline: copy.tagline,
                shortDescription: copy.shortDescription,
                longDescription: copy.longDescription,
                category: p.category || copy.category,
                websiteUrl: p.websiteUrl || url,
              }
            : p,
        ),
      );
      await markDirty(true);
      setNote({ kind: "ok", text: "Generated — review, then Save." });
    } catch (e) {
      setNote({ kind: "warn", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function onFill() {
    setBusy("fill");
    setNote(null);
    setResult(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab.");
      // Prefer a curated field map for this domain; fall back to heuristics.
      const host = tab.url ? new URL(tab.url).hostname.replace(/^www\./, "") : "";
      const fieldMap = host ? await fetchFieldMap(host) : null;
      const res = (await chrome.tabs
        .sendMessage(tab.id, { type: "FILL_PAGE", profile: active, fieldMap })
        .catch(() => null)) as FillResult | null;
      if (!res) {
        throw new Error("Couldn't reach the page — open the submission form, reload, then retry.");
      }
      setResult(res);
    } catch (e) {
      setNote({ kind: "warn", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function onMarkSubmitted() {
    if (active.id === "new") {
      setNote({ kind: "warn", text: "Save the profile first to track submissions." });
      return;
    }
    setBusy("mark");
    setNote(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const host = tab?.url ? new URL(tab.url).hostname.replace(/^www\./, "") : "";
      if (!host) throw new Error("No active tab URL.");
      const dir = await findDirectoryByDomain(host);
      if (!dir) throw new Error(`No directory matching "${host}".`);
      await markSubmitted({
        directoryId: dir.id,
        profileId: active.id,
        status: "submitted",
        postUrl: tab?.url ?? null,
      });
      setNote({ kind: "ok", text: `Marked submitted: ${dir.name}.` });
    } catch (e) {
      setNote({ kind: "warn", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <header>
      <h1>
        SAAS<span style={{ color: "var(--accent)" }}>registry</span>
      </h1>
      {signedIn && (
        <div className="account">
          <button className="gear" title="Account" onClick={() => setShowAccount((v) => !v)}>
            ⋮
          </button>
          {showAccount && (
            <div className="menu card">
              <button
                className="ghost"
                onClick={() => {
                  setShowAccount(false);
                  void onSync();
                }}
              >
                Refresh profiles
              </button>
              <button
                className="ghost"
                onClick={() => void chrome.tabs.create({ url: `${APP_URL}/dashboard` })}
              >
                Open dashboard
              </button>
              <button className="ghost" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );

  if (!signedIn) {
    return (
      <div className="wrap">
        {header}
        <div className="card signed-out">
          <p className="muted small">
            Sign in to load your startup profiles and pre-fill submission forms.
          </p>
          <button onClick={onSignIn} disabled={busy === "auth"}>
            {busy === "auth" ? "Signing in…" : "Sign in"}
          </button>
        </div>
        {note && (
          <div className={`small ${note.kind}`} role="status">
            {note.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wrap">
      {header}

      <div className="row profile-row">
        <select value={active.id} onChange={(e) => onSelectProfile(e.target.value)}>
          {profiles
            .filter((p) => p.id !== "new")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.startupName || "(untitled)"}
              </option>
            ))}
          <option value="new">+ New profile</option>
        </select>
        {settings.dirty && <span className="chip warn">Unsaved</span>}
      </div>

      <div className="card">
        <div className="row">
          <input
            placeholder="https://your-startup.com"
            value={genUrl}
            onChange={(e) => setGenUrl(e.target.value)}
          />
          <button onClick={onGenerate} disabled={busy === "gen"} style={{ flex: "0 0 auto" }}>
            {busy === "gen" ? "Generating…" : "Generate with AI"}
          </button>
        </div>

        {TEXT_FIELDS.map(([key, label, type]) => (
          <label className="field" key={key}>
            {label}
            <input
              type={type ?? "text"}
              value={(active[key] as string | null) ?? ""}
              onChange={(e) => update(key, e.target.value as StartupProfile[typeof key])}
            />
          </label>
        ))}
        <label className="field">
          Short description
          <textarea
            rows={2}
            value={active.shortDescription}
            onChange={(e) => update("shortDescription", e.target.value)}
          />
        </label>
        <label className="field">
          Long description
          <textarea
            rows={4}
            value={active.longDescription}
            onChange={(e) => update("longDescription", e.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <button onClick={onSave} disabled={busy === "save" || !settings.dirty}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          className="ghost"
          onClick={onDiscard}
          disabled={!settings.dirty || busy === "sync"}
        >
          Discard
        </button>
      </div>

      <div className="row">
        <button onClick={onFill} disabled={busy === "fill"}>
          {busy === "fill" ? "Filling…" : "Fill this page"}
        </button>
        <button className="ghost" onClick={onMarkSubmitted} disabled={busy === "mark"}>
          {busy === "mark" ? "…" : "Mark submitted"}
        </button>
      </div>

      {note && (
        <div className={`small ${note.kind}`} role="status">
          {note.text}
        </div>
      )}

      {result && (
        <div className="card result small">
          <div>
            <span className="ok">Filled {result.filled.length}</span> ·{" "}
            <span className="warn">{result.ambiguous.length} need review</span> · {result.skipped}{" "}
            skipped of {result.total} ({result.mode})
          </div>
          {result.filled.length > 0 && (
            <ul>
              {result.filled.slice(0, 8).map((f, i) => (
                <li key={i} className="muted">
                  {f.label} → {f.key}
                </li>
              ))}
            </ul>
          )}
          {result.ambiguous.length > 0 && (
            <div className="muted">
              Review (not filled): {result.ambiguous.map((a) => a.label).slice(0, 6).join(", ")}
            </div>
          )}
        </div>
      )}

      <div className="small muted">
        Always review every field before you submit. Nothing is auto-submitted.
      </div>
    </div>
  );
}
