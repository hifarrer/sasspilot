import { NextResponse } from "next/server";
import { isAutoSubmitEnabled } from "./autoSubmitEnabled";
import { getRequestUser } from "./authz";

/**
 * Shared gate for every /api/auto-submit/* route: feature flag first (503 if off, so
 * production never proceeds), then an authenticated user — the web session cookie OR a
 * Bearer PAT (via getRequestUser). Returns the userId or a ready-to-return NextResponse.
 */
export async function guardAutoSubmit(
  req: Request,
): Promise<{ userId: string } | { response: NextResponse }> {
  if (!isAutoSubmitEnabled()) {
    return { response: NextResponse.json({ error: "auto_submit_disabled" }, { status: 503 }) };
  }
  const user = await getRequestUser(req);
  if (!user) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { userId: user.id };
}
