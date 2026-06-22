import { NextResponse } from "next/server";
import { guardAutoSubmit } from "@/lib/autoSubmitGuard";
import { finishLogin } from "@/lib/autoSubmitJobs";

export const dynamic = "force-dynamic";

/** Close the login browser, flushing saved sessions to the local profile. */
export async function POST(req: Request) {
  const g = await guardAutoSubmit(req);
  if ("response" in g) return g.response;

  await finishLogin();
  return NextResponse.json({ ok: true });
}
