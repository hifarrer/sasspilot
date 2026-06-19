export type Command = "login" | "run";

/** One directory to target, by slug. `submitUrl`/`allowPaid` override the catalog. */
export interface TargetSpec {
  slug: string;
  submitUrl?: string;
  allowPaid?: boolean;
}

export interface RunConfig {
  command: Command;
  apiBase: string;
  token: string;
  targets: TargetSpec[];
  profileId: string | null;
  /** true = actually click submit; false = dry run (fill only). */
  submit: boolean;
  headed: boolean;
  allowPaid: boolean;
  /** Don't click submit if a required field couldn't be filled. */
  requireAllFields: boolean;
  limit: number | null;
  timeoutMs: number;
  /** Write CRM rows even on a dry run. */
  recordDryRun: boolean;
}

export type FieldAction =
  | "filled"
  | "skipped-ambiguous"
  | "skipped-novalue"
  | "skipped-fileupload"
  | "skipped-unfillable"
  | "error";

export interface FieldOutcome {
  key: string;
  selector: string;
  action: FieldAction;
  detail?: string;
}

export type Blocker = "login" | "captcha" | "payment";

export type SubmitOutcome = "submitted" | "rejected" | "pending" | "skipped" | "dry-run";

/** Everything we learned about one site this run — drives the report and the CRM write. */
export interface SiteResult {
  slug: string;
  directoryId: string | null;
  url: string | null;
  tier: "map" | "heuristic" | "none";
  fields: FieldOutcome[];
  blocker: Blocker | null;
  submitOutcome: SubmitOutcome;
  /** CRM status actually POSTed, or null if nothing was recorded. */
  recordedStatus: string | null;
  postUrl: string;
  screenshot: string | null;
  error?: string;
  note?: string;
  durationMs: number;
}
