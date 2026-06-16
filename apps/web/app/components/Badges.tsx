export function DrBadge({ dr }: { dr: number | null }) {
  if (dr == null) return null;
  const color = dr >= 80 ? "#34d399" : dr >= 50 ? "#fbbf24" : "#94a3b8";
  return (
    <span className="badge" title="Ahrefs Domain Rating" style={{ color }}>
      DR {dr}
    </span>
  );
}

export function CostBadge({ cost }: { cost: string }) {
  const map: Record<string, string> = {
    free: "#34d399",
    freemium: "#60a5fa",
    paid: "#f472b6",
  };
  return (
    <span className="badge" style={{ color: map[cost] ?? "var(--text-muted)" }}>
      {cost}
    </span>
  );
}

export function BacklinkBadge({ type }: { type: string }) {
  if (type === "none") return null;
  return (
    <span className="badge" style={{ color: type === "dofollow" ? "#34d399" : "var(--text-muted)" }}>
      {type}
    </span>
  );
}
