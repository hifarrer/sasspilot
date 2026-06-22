import { mkdir } from "node:fs/promises";
import path from "node:path";
import { type Api, type ApiDirectory, createApi } from "./api";
import { type LoginTarget, openContext, runLogin } from "./browser";
import { loadConfig } from "./config";
import { log, maskToken, randInt } from "./log";
import { RUNS_DIR } from "./paths";
import { processSite } from "./pipeline";
import { type RunReport, writeReport } from "./report";
import type { RunConfig, SiteResult } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function decideCrmStatus(r: SiteResult, config: RunConfig): string | null {
  if (r.submitOutcome === "skipped") return null;
  // A dry run never writes to the CRM unless explicitly opted in — even for sites
  // that were blocked (login/CAPTCHA/payment) before any fill was attempted.
  if (!config.submit && !config.recordDryRun) return null;
  switch (r.submitOutcome) {
    case "submitted":
      return "submitted";
    case "rejected":
      return "rejected";
    case "pending":
      return "pending";
    case "dry-run":
      return "not_started";
    default:
      return null;
  }
}

function buildNotes(r: SiteResult): string {
  const filled = r.fields.filter((f) => f.action === "filled").map((f) => f.key);
  const skipped = r.fields
    .filter((f) => f.action !== "filled")
    .map((f) => `${f.key}(${f.action.replace("skipped-", "")})`);
  const parts = [`[auto-submit] tier=${r.tier}`, `filled: ${filled.length ? filled.join(",") : "none"}`];
  if (skipped.length) parts.push(`skipped: ${skipped.join(",")}`);
  if (r.blocker) parts.push(`blocker: ${r.blocker}`);
  parts.push(`outcome: ${r.submitOutcome}${r.note ? ` (${r.note})` : ""}`);
  if (r.error) parts.push(`error: ${r.error}`);
  const s = parts.join("; ");
  return s.length > 900 ? `${s.slice(0, 897)}…` : s;
}

function skeletonSkip(slug: string, note: string, directoryId: string | null = null): SiteResult {
  return {
    slug,
    directoryId,
    url: null,
    tier: "none",
    fields: [],
    blocker: null,
    submitOutcome: "skipped",
    recordedStatus: null,
    postUrl: "",
    screenshot: null,
    note,
    durationMs: 0,
  };
}

function logResult(r: SiteResult): void {
  const filled = r.fields.filter((f) => f.action === "filled").length;
  const msg = `${r.submitOutcome} · ${filled} filled${r.blocker ? ` · ${r.blocker}` : ""}${r.note ? ` · ${r.note}` : ""}`;
  if (r.submitOutcome === "submitted") log.ok(msg);
  else if (r.submitOutcome === "rejected") log.error(msg);
  else log.warn(msg);
}

function tally(results: SiteResult[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of results) c[r.submitOutcome] = (c[r.submitOutcome] ?? 0) + 1;
  return c;
}

async function runSubmit(config: RunConfig, api: Api): Promise<void> {
  log.info(
    `API ${config.apiBase} · token ${maskToken(config.token)} · mode ${config.submit ? "SUBMIT (live)" : "dry-run"}`,
  );

  const profiles = await api.fetchProfiles();
  if (profiles.length === 0) throw new Error("No startup profiles found for this account.");
  const profile = config.profileId ? profiles.find((p) => p.id === config.profileId) : profiles[0];
  if (!profile) throw new Error(`Profile ${config.profileId} not found for this account.`);
  log.info(`Profile: ${profile.startupName} (${profile.id})`);

  const directories = await api.fetchAllDirectories();
  const bySlug = new Map(directories.map((d) => [d.slug, d]));

  const existing = await api.fetchSubmissions(profile.id);
  const done = new Set(
    existing
      .filter((s) => s.status === "submitted" || s.status === "published")
      .map((s) => s.directoryId),
  );

  const runDir = path.join(RUNS_DIR, new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(runDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const results: SiteResult[] = [];
  const context = await openContext({ headed: config.headed });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(config.timeoutMs);

    for (const [i, target] of config.targets.entries()) {
      log.step(`(${i + 1}/${config.targets.length}) ${target.slug}`);
      const directory = bySlug.get(target.slug);

      if (!directory) {
        log.warn("unknown slug — not in the catalog; skipping");
        results.push(skeletonSkip(target.slug, "unknown slug"));
        continue;
      }
      const url = target.submitUrl ?? directory.submissionUrl;
      if (!url) {
        log.warn("no submission URL; skipping");
        results.push(skeletonSkip(directory.slug, "no submission URL", directory.id));
        continue;
      }
      if (directory.cost === "paid" && !config.allowPaid && !target.allowPaid) {
        log.warn("paid directory; skipping (use --allow-paid)");
        results.push(skeletonSkip(directory.slug, "paid", directory.id));
        continue;
      }
      if (done.has(directory.id)) {
        log.ok("already submitted; skipping");
        results.push(skeletonSkip(directory.slug, "already submitted", directory.id));
        continue;
      }

      const result = await processSite(page, config, profile, directory, url, runDir, {
        getFieldMap: (d) => api.fetchFieldMap(d),
      });

      const status = decideCrmStatus(result, config);
      if (status && result.directoryId) {
        try {
          await api.postSubmission({
            directoryId: result.directoryId,
            profileId: profile.id,
            status,
            postUrl: result.postUrl || "",
            notes: buildNotes(result),
          });
          result.recordedStatus = status;
        } catch (e) {
          log.warn(`CRM write failed: ${(e as Error).message}`);
        }
      }

      logResult(result);
      results.push(result);

      if (i < config.targets.length - 1) await sleep(randInt(1500, 4000));
    }
  } finally {
    await context.close();
  }

  const counts = tally(results);
  const report: RunReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    mode: config.submit ? "submit" : "dry-run",
    profileId: profile.id,
    apiBase: config.apiBase,
    counts,
    results,
  };
  const reportFile = await writeReport(runDir, report);

  log.step("Run complete");
  for (const [k, v] of Object.entries(counts)) log.info(`  ${k}: ${v}`);
  log.info(`  report: ${reportFile}`);
}

async function runLoginCmd(config: RunConfig, api: Api): Promise<void> {
  const directories = await api.fetchAllDirectories().catch(() => [] as ApiDirectory[]);
  const bySlug = new Map(directories.map((d) => [d.slug, d]));

  const targets: LoginTarget[] = [];
  for (const t of config.targets) {
    const d = bySlug.get(t.slug);
    const url = t.submitUrl ?? d?.submissionUrl;
    if (!url) {
      log.warn(`No URL for ${t.slug}; skipping in the login walkthrough.`);
      continue;
    }
    targets.push({ slug: t.slug, name: d?.name ?? t.slug, url });
  }
  if (targets.length === 0) throw new Error("No login targets resolved.");
  await runLogin(targets);
}

async function main(): Promise<void> {
  const config = loadConfig(process.argv);
  const api = createApi(config.apiBase, config.token);
  if (config.command === "login") await runLoginCmd(config, api);
  else await runSubmit(config, api);
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
