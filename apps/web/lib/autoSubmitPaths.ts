import path from "node:path";

/**
 * Absolute path to tools/auto-submit/.runs (where the runner writes screenshots).
 * Computed from the web app's cwd (apps/web under `pnpm web`) so neither the job
 * manager nor the screenshots route depends on the tool's internal path resolution.
 */
export const RUNS_BASE = path.resolve(process.cwd(), "..", "..", "tools", "auto-submit", ".runs");

/** A fresh run directory + its url-safe stamp (used in screenshot paths). */
export function newRunDir(): { runDir: string; stamp: string } {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return { runDir: path.join(RUNS_BASE, stamp), stamp };
}
