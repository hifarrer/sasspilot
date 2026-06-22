import { NextResponse } from "next/server";
import { guardAutoSubmit } from "@/lib/autoSubmitGuard";
import { getCurrent } from "@/lib/autoSubmitJobs";

export const dynamic = "force-dynamic";

/** Current job status + per-site progress, for the dashboard to poll. */
export async function GET(req: Request) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  return NextResponse.json({ job: getCurrent() });
}
