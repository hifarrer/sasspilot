import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { guardAutoSubmit } from "@/lib/autoSubmitGuard";
import { RUNS_BASE } from "@/lib/autoSubmitPaths";

export const dynamic = "force-dynamic";

/** Serve a screenshot PNG from tools/auto-submit/.runs, guarded against traversal. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  const { path: parts } = await params;
  const target = path.resolve(RUNS_BASE, ...parts);
  if (!target.startsWith(path.resolve(RUNS_BASE) + path.sep)) {
    return new Response("forbidden", { status: 400 });
  }
  if (!target.endsWith(".png") || !existsSync(target)) {
    return new Response("not found", { status: 404 });
  }
  const data = await readFile(target);
  return new Response(new Uint8Array(data), {
    headers: { "content-type": "image/png", "cache-control": "no-store" },
  });
}
