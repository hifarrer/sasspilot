import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { classifyField, shouldFill } from "@aisas/shared/classifier";
import { type FieldMap, type StartupProfile, valueForKey } from "@aisas/shared/types";
import type { Page } from "playwright";
import { detectBlocker } from "./detect";
import { readFields } from "./extract";
import { type FillTask, fillField } from "./fill";
import { randInt } from "./log";
import { LOCAL_FIELD_MAPS_DIR } from "./paths";
import { clickSubmitAndDetect } from "./submit";
import type { FieldOutcome, SiteResult } from "./types";

/** The behavioural knobs processSite needs — a narrow slice of the CLI's RunConfig. */
export interface ProcessSiteOptions {
  timeoutMs: number;
  submit: boolean;
  requireAllFields: boolean;
}

/** Caller-injected data lookups, so the pipeline doesn't depend on the HTTP API. */
export interface ProcessSiteDeps {
  getFieldMap(domain: string): Promise<FieldMap | null>;
}

/** The minimal directory shape processSite reads. */
export interface PipelineDirectory {
  id: string;
  slug: string;
  domain: string;
}

export function domainKey(d: string): string {
  return d.replace(/^www\./, "");
}

/** Load a curated field-map draft from data/field-maps/<slug>.json, if present. */
export function loadLocalFieldMap(slug: string): FieldMap | null {
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

export function tasksFromMap(map: FieldMap, profile: StartupProfile): FillTask[] {
  return map.fields.map((e) => ({
    key: e.canonicalKey,
    selector: e.selector,
    value: e.optionText ?? valueForKey(profile, e.canonicalKey),
    inputType: e.inputType,
    required: e.required,
  }));
}

/** Live discovery + classification fallback when no curated map exists. */
export async function tasksFromPage(
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

/**
 * Open one directory's submit page, fill it, and (when opts.submit) click submit —
 * returning a SiteResult. Field maps are resolved via the injected deps so this is
 * reusable by both the CLI (HTTP API) and the web app (direct Prisma).
 */
export async function processSite(
  page: Page,
  opts: ProcessSiteOptions,
  profile: StartupProfile,
  directory: PipelineDirectory,
  url: string,
  runDir: string,
  deps: ProcessSiteDeps,
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
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
    await page.waitForTimeout(randInt(700, 1400));

    const blocker = await detectBlocker(page);
    if (blocker) {
      result.blocker = blocker;
      result.submitOutcome = "pending";
      result.note = `${blocker} blocked — ${blocker === "login" ? "log in first" : "needs a human"}`;
      return finalize();
    }

    // Tier 1: curated map (injected lookup, then local file). Tier 2: live classification.
    let map = await deps.getFieldMap(domainKey(directory.domain));
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

    if (!opts.submit) {
      result.submitOutcome = "dry-run";
      return finalize();
    }

    const requiredUnfilled = tasks.filter(
      (t) =>
        t.required &&
        !result.fields.some((f) => f.selector === t.selector && f.action === "filled"),
    );
    if (opts.requireAllFields && requiredUnfilled.length > 0) {
      result.submitOutcome = "pending";
      result.note = `required field(s) unfilled: ${requiredUnfilled.map((t) => t.key).join(", ")}`;
      return finalize();
    }

    if (result.fields.filter((f) => f.action === "filled").length === 0) {
      result.submitOutcome = "pending";
      result.note = "nothing fillable on the page";
      return finalize();
    }

    const submitRes = await clickSubmitAndDetect(page, opts.timeoutMs);
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
