import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { classifyField, shouldFill } from "@aisas/shared/classifier";
import { type FieldMap, type StartupProfile, valueForKey } from "@aisas/shared/types";
import type { Page } from "playwright";
import { type Api, type ApiDirectory, createApi } from "./api";
import { type LoginTarget, openContext, runLogin } from "./browser";
import { loadConfig } from "./config";
import { detectBlocker } from "./detect";
import { readFields } from "./extract";
import { type FillTask, fillField } from "./fill";
import { log, maskToken, randInt } from "./log";
import { LOCAL_FIELD_MAPS_DIR, RUNS_DIR } from "./paths";
import { type RunReport, writeReport } from "./report";
import { clickSubmitAndDetect } from "./submit";
import type { FieldOutcome, RunConfig, SiteResult } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function domainKey(d: string): string {
  return d.replace(/^www\./, "");
}

/** Load a curated field-map draft from data/field-maps/<slug>.json, if present. */
function loadLocalFieldMap(slug: string): FieldMap | null {
  const file = path.join(LOCAL_FIELD_MAPS_DIR, `${slug}.json`);
  if (!existsSync(file)) return null;
  try {
    const draft = JSON.parse(readFileSync(file, "utf8")) as { fields?: unknown; domain?: string };
    const fields = (Array.isArray(draft.fields) ? draft.fields : []) as FieldMap["fields"];
    if (fields.length === 0) return null;
    return {
      directoryId: "",
      domain: draft.domain ?? "",
      version: 0,
      fields,
      discoveredBy: "playwright",
      confidence: 0,
      lastVerifiedAt: null,
    };
  } catch {
    return null;
  }
}

function tasksFromMap(map: FieldMap, profile: StartupProfile): FillTask[] {
  return map.fields.map((e) => ({
    key: e.canonicalKey,
    selector: e.selector,
    value: e.optionText ?? valueForKey(profile, e.canonicalKey),
    inputType: e.inputType,
    required: e.required,
  }));
}

/** Live discovery + classification fallback when no curated map exists. */
async function tasksFromPage(
  page: Page,
  profile: StartupProfile,
): Promise<{ tasks: FillTask[]; preOutcomes: FieldOutcome[] }> {
  const raw = await readFields(page);
  const tasks: FillTask[] = [];
  const preOutcomes: FieldOutcome[] = [];

  for (const f of raw) {
    if (f.isPassword) continue;
    const c = classifyField(f.signals);
    if (!c) continue; // unrecognized field — ignore
    if (!shouldFill(c)) {
      preOutcomes.push({
        key: c.key,
        selector: f.selector,
        action: "skipped-ambiguous",
        detail: c.confidence,
      });
      continue;
    }
    tasks.push({
      key: c.key,
      selector: f.selector,
      value: valueForKey(profile, c.key),
      inputType: f.signals.type ?? undefined,
      maxLength: f.signals.maxLength,
    });
  }
  return { tasks, preOutcomes };
}

async function processSite(
  page: Page,
  config: RunConfig,
  profile: StartupProfile,
  api: Api,
  directory: ApiDirectory,
  url: string,
  runDir: string,
): Promise<SiteResult> {
  const started = Date.now();
  const result: SiteResult = {
    slug: directory.slug,
    directoryId: directory.id,
    url,
    tier: "none",
    fields: [],
    blocker: null,
    submitOutcome: "pending",
    recordedStatus: null,
    postUrl: "",
    screenshot: null,
    durationMs: 0,
  };

  async function finalize(): Promise<SiteResult> {
    result.durationMs = Date.now() - started;
    try {
      const shot = path.join(runDir, `${directory.slug}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      result.screenshot = path.basename(shot);
    } catch {
      // screenshot is best-effort
    }
    return result;
  }

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
    await page.waitForTimeout(randInt(700, 1400));

    const blocker = await detectBlocker(page);
    if (blocker) {
      result.blocker = blocker;
      result.submitOutcome = "pending";
      result.note = `${blocker} blocked — ${blocker === "login" ? "run the login command first" : "needs a human"}`;
      return finalize();
    }

    // Tier 1: curated map (API, then local file). Tier 2: live classification.
    let map = await api.fetchFieldMap(domainKey(directory.domain));
    if (!map || map.fields.length === 0) map = loadLocalFieldMap(directory.slug);

    let tasks: FillTask[];
    if (map && map.fields.length > 0) {
      result.tier = "map";
      tasks = tasksFromMap(map, profile);
    } else {
      result.tier = "heuristic";
      const t = await tasksFromPage(page, profile);
      tasks = t.tasks;
      result.fields.push(...t.preOutcomes);
    }

    for (const task of tasks) {
      result.fields.push(await fillField(page, task));
      await page.waitForTimeout(randInt(250, 700));
    }

    if (!config.submit) {
      result.submitOutcome = "dry-run";
      return finalize();
    }

    const requiredUnfilled = tasks.filter(
      (t) =>
        t.required &&
        !result.fields.some((f) => f.selector === t.selector && f.action === "filled"),
    );
    if (config.requireAllFields && requiredUnfilled.length > 0) {
      result.submitOutcome = "pending";
      result.note = `required field(s) unfilled: ${requiredUnfilled.map((t) => t.key).join(", ")}`;
      return finalize();
    }

    if (result.fields.filter((f) => f.action === "filled").length === 0) {
      result.submitOutcome = "pending";
      result.note = "nothing fillable on the page";
      return finalize();
    }

    const submitRes = await clickSubmitAndDetect(page, config.timeoutMs);
    result.submitOutcome = submitRes.outcome;
    result.postUrl = submitRes.postUrl;
    result.note = submitRes.note;
    return finalize();
  } catch (e) {
    result.error = (e as Error).message;
    // A crash isn't a rejection of our data — leave it pending for a retry.
    return finalize();
  }
}

function decideCrmStatus(r: SiteResult, config: RunConfig): string | null {
  switch (r.submitOutcome) {
    case "submitted":
      return "submitted";
    case "rejected":
      return "rejected";
    case "pending":
      return "pending";
    case "dry-run":
      return config.recordDryRun ? "not_started" : null;
    default:
      return null; // skipped
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

      const result = await processSite(page, config, profile, api, directory, url, runDir);

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
