import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)); // tools/auto-submit/src

export const TOOL_DIR = path.resolve(here, ".."); // tools/auto-submit
export const REPO_ROOT = path.resolve(here, "../../.."); // repo root

/** Persistent Chromium profile (live session cookies) — gitignored, sensitive. */
export const PROFILE_DIR = path.join(TOOL_DIR, ".profile");
/** Per-run artifacts (report.json + screenshots) — gitignored. */
export const RUNS_DIR = path.join(TOOL_DIR, ".runs");
/** Curated field-map drafts produced by tools/field-discovery. */
export const LOCAL_FIELD_MAPS_DIR = path.join(REPO_ROOT, "data", "field-maps");
