// Local-only job manager for the auto-submit dashboard tool. Holds one in-flight job
// + the live login BrowserContext as a globalThis singleton (single dev process; lost
// on restart — acceptable for a local testing tool). The Playwright core is reached
// ONLY via a runtime dynamic import so it never enters the production build graph.
import type { FieldMap, StartupProfile } from "@aisas/shared/types";
import type { LoginSession, SiteResult } from "@aisas/auto-submit/core";
import { newRunDir } from "./autoSubmitPaths";

export type JobStatus = "running" | "awaiting-finish" | "done" | "error";

export interface SiteProgress {
  slug: string;
  state: "pending" | "running" | "done";
  result?: SiteResult;
}

export interface Job {
  id: string;
  type: "login" | "run";
  status: JobStatus;
  mode?: "dry-run" | "submit";
  startedAt: string;
  finishedAt?: string;
  stamp?: string; // screenshots live under .runs/<stamp>/
  sites: SiteProgress[];
  logs: string[];
  error?: string;
}

export interface LoginTargetInput {
  slug: string;
  name: string;
  url: string;
}

export interface RunSiteInput {
  directory: { id: string; slug: string; domain: string };
  url: string;
}

export interface StartRunInput {
  profile: StartupProfile;
  sites: RunSiteInput[];
  mode: "dry-run";
  getFieldMap: (domain: string) => Promise<FieldMap | null>;
  timeoutMs?: number;
}

interface State {
  current: Job | null;
  loginSession: LoginSession | null;
}

const g = globalThis as unknown as { __autoSubmitState?: State };
const state: State = (g.__autoSubmitState ??= { current: null, loginSession: null });

export class JobBusyError extends Error {}

function isBusy(): boolean {
  return state.current?.status === "running" || state.current?.status === "awaiting-finish";
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getCurrent(): Job | null {
  return state.current;
}

export async function startLogin(targets: LoginTargetInput[]): Promise<Job> {
  if (isBusy()) throw new JobBusyError("A job is already running.");
  // Close any session left over from an abandoned login.
  if (state.loginSession) {
    await state.loginSession.close().catch(() => {});
    state.loginSession = null;
  }
  const core = await import("@aisas/auto-submit/core");
  state.loginSession = await core.openLoginSession(targets);
  const job: Job = {
    id: newId(),
    type: "login",
    status: "awaiting-finish",
    startedAt: new Date().toISOString(),
    sites: targets.map((t) => ({ slug: t.slug, state: "pending" })),
    logs: [`Opened ${targets.length} site(s). Sign into each, then click "I'm done".`],
  };
  state.current = job;
  return job;
}

export async function finishLogin(): Promise<void> {
  if (state.loginSession) {
    await state.loginSession.close().catch(() => {});
    state.loginSession = null;
  }
  if (state.current?.type === "login") {
    state.current.status = "done";
    state.current.finishedAt = new Date().toISOString();
    state.current.logs.push("Sessions saved to the local browser profile.");
  }
}

export function startRun(input: StartRunInput): Job {
  if (isBusy()) throw new JobBusyError("A job is already running.");
  const { runDir, stamp } = newRunDir();
  const job: Job = {
    id: newId(),
    type: "run",
    status: "running",
    mode: input.mode,
    startedAt: new Date().toISOString(),
    stamp,
    sites: input.sites.map((s) => ({ slug: s.directory.slug, state: "pending" })),
    logs: [`Dry run over ${input.sites.length} site(s).`],
  };
  state.current = job;
  void runJob(job, input, runDir); // fire-and-forget; the client polls getCurrent()
  return job;
}

async function runJob(job: Job, input: StartRunInput, runDir: string): Promise<void> {
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(runDir, { recursive: true });
    const core = await import("@aisas/auto-submit/core");
    const timeoutMs = input.timeoutMs ?? 45_000;
    const opts = { timeoutMs, submit: false, requireAllFields: true };

    const context = await core.openContext({ headed: false });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);
      for (let i = 0; i < input.sites.length; i++) {
        const site = input.sites[i];
        const prog = job.sites[i];
        prog.state = "running";
        const result = await core.processSite(
          page,
          opts,
          input.profile,
          site.directory,
          site.url,
          runDir,
          { getFieldMap: input.getFieldMap },
        );
        prog.result = result;
        prog.state = "done";
        const filled = result.fields.filter((f) => f.action === "filled").length;
        job.logs.push(`${site.directory.slug}: ${result.submitOutcome} (${filled} filled)`);
      }
      const results = job.sites.map((s) => s.result).filter((r): r is SiteResult => Boolean(r));
      await core.writeReport(runDir, {
        startedAt: job.startedAt,
        finishedAt: new Date().toISOString(),
        mode: "dry-run",
        profileId: input.profile.id,
        apiBase: "in-process",
        counts: tally(results),
        results,
      });
    } finally {
      await context.close();
    }
    job.status = "done";
    job.finishedAt = new Date().toISOString();
    job.logs.push("Done.");
  } catch (e) {
    job.status = "error";
    job.error = (e as Error).message;
    job.finishedAt = new Date().toISOString();
    job.logs.push(`Error: ${(e as Error).message}`);
  }
}

function tally(results: SiteResult[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of results) c[r.submitOutcome] = (c[r.submitOutcome] ?? 0) + 1;
  return c;
}
