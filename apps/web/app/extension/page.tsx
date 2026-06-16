const STEPS = [
  "Build it: pnpm --filter @aisas/extension build (outputs packages/extension/dist).",
  "Open chrome://extensions, enable Developer mode, click Load unpacked, and select packages/extension/dist.",
  "Click the extension, then Sign in — this logs you in and connects in one step. Your profiles sync automatically (pick one from the dropdown).",
  "Edit a profile in the popup and Save to push changes back here, or manage profiles from this dashboard.",
  "On any submission page, click Fill this page. Review every field, then submit yourself.",
];

export default function ExtensionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Browser extension</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Pre-fills each directory&apos;s submission form from your startup profile. It maps fields
          to a canonical schema (curated map per site when available, smart heuristics otherwise),
          highlights what it filled, and flags anything ambiguous. It never submits for you.
        </p>
      </div>

      <ol className="card flex flex-col gap-3 p-6 text-sm">
        {STEPS.map((s, i) => (
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

      <div className="card p-6 text-sm" style={{ color: "var(--text-muted)" }}>
        <strong style={{ color: "var(--text)" }}>Tip:</strong> use “Generate with AI” to draft your
        tagline and descriptions from your site URL, then reuse the same profile across every
        directory.
      </div>
    </div>
  );
}
