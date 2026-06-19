import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, TOOL_DIR } from "./paths";
import type { Command, RunConfig, TargetSpec } from "./types";

/** Load KEY=VALUE pairs from repo-root and tool-local .env (without overriding real env). */
function loadDotEnv(): void {
  for (const file of [path.join(REPO_ROOT, ".env"), path.join(TOOL_DIR, ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m) continue;
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
}

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function readTargetsFile(file: string): { profileId: string | null; targets: TargetSpec[] } {
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    profileId?: string | null;
    targets?: Array<string | TargetSpec>;
  };
  const targets: TargetSpec[] = (raw.targets ?? [])
    .map((t) => (typeof t === "string" ? { slug: t } : t))
    .filter((t) => t && typeof t.slug === "string" && t.slug.length > 0);
  return { profileId: raw.profileId ?? null, targets };
}

const USAGE = `Usage:
  tsx src/index.ts login [--slugs a,b | --targets <file>] [--headed]
  tsx src/index.ts run  [--dry-run | --submit] [--slugs a,b | --targets <file>]
                        [--profile-id <id>] [--limit n] [--headed] [--allow-paid]
                        [--no-require-all-fields] [--timeout ms] [--record-dry-run]`;

export function loadConfig(argv: string[]): RunConfig {
  loadDotEnv();

  const command = (argv[2] ?? "") as Command;
  if (command !== "login" && command !== "run") {
    throw new Error(`Unknown command "${argv[2] ?? ""}".\n${USAGE}`);
  }

  const apiBase = (
    process.env.AUTOSUBMIT_API_BASE ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  const token = process.env.AUTOSUBMIT_TOKEN ?? "";

  // Targets: --slugs overrides the targets file.
  const slugsArg = argValue(argv, "slugs");
  let fileProfileId: string | null = null;
  let targets: TargetSpec[] = [];
  if (slugsArg) {
    targets = slugsArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((slug) => ({ slug }));
  } else {
    const targetsFile = path.resolve(
      argValue(argv, "targets") ?? path.join(TOOL_DIR, "targets.json"),
    );
    if (!existsSync(targetsFile)) {
      throw new Error(
        `No targets. Pass --slugs a,b or create ${path.relative(
          REPO_ROOT,
          targetsFile,
        )} (copy targets.example.json).`,
      );
    }
    const parsed = readTargetsFile(targetsFile);
    fileProfileId = parsed.profileId;
    targets = parsed.targets;
  }
  if (targets.length === 0) throw new Error("No targets to process.");

  const limitArg = argValue(argv, "limit");
  const timeoutArg = argValue(argv, "timeout");

  const config: RunConfig = {
    command,
    apiBase,
    token,
    targets,
    profileId: argValue(argv, "profile-id") ?? fileProfileId,
    // Dry run is the safe default; --submit opts in, but an explicit --dry-run always wins.
    submit: hasFlag(argv, "submit") && !hasFlag(argv, "dry-run"),
    headed: hasFlag(argv, "headed"),
    allowPaid: hasFlag(argv, "allow-paid"),
    requireAllFields: !hasFlag(argv, "no-require-all-fields"),
    limit: limitArg ? Math.max(1, Number(limitArg)) : null,
    timeoutMs: timeoutArg ? Math.max(5000, Number(timeoutArg)) : 45_000,
    recordDryRun: hasFlag(argv, "record-dry-run"),
  };

  if (config.command === "run" && !config.token) {
    throw new Error(
      "AUTOSUBMIT_TOKEN is required for `run`. Mint a personal access token in the web app and set it in .env or the environment.",
    );
  }
  if (config.limit != null) config.targets = config.targets.slice(0, config.limit);

  return config;
}
