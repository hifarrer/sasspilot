// Public, importable surface of the auto-submit tool — consumed by the web app's
// (local-only) dashboard runner. Keep this free of CLI/stdin/console concerns.
export { type LoginTarget, openContext } from "./browser";
export { type LoginSession, openLoginSession } from "./login";
export {
  type PipelineDirectory,
  type ProcessSiteDeps,
  type ProcessSiteOptions,
  processSite,
} from "./pipeline";
export { type RunReport, writeReport } from "./report";
export type { FieldOutcome, SiteResult } from "./types";
