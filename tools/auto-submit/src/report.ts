import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SiteResult } from "./types";

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  mode: "dry-run" | "submit";
  profileId: string;
  apiBase: string;
  counts: Record<string, number>;
  results: SiteResult[];
}

/** Write report.json into the run dir (created if needed). Returns its path. */
export async function writeReport(dir: string, report: RunReport): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "report.json");
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  return file;
}
