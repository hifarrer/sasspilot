import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { db } from "./db";

export interface AuthedUser {
  id: string;
}

/** Current signed-in web user, or null. Never throws (auth may be unconfigured). */
export async function getSessionUser(): Promise<AuthedUser | null> {
  try {
    const session = await auth();
    if (session?.user?.id) return { id: session.user.id };
  } catch {
    // Auth.js not configured (no AUTH_SECRET / providers) — treat as signed out.
  }
  return null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a new personal access token (returned to the user exactly once). */
export function generateToken(): { token: string; hash: string } {
  const token = `aisas_${randomBytes(24).toString("hex")}`;
  return { token, hash: hashToken(token) };
}

/**
 * Resolve the acting user for an API request: first an `Authorization: Bearer <pat>`
 * header (used by the extension), then the web session cookie.
 */
export async function getRequestUser(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) {
      const rec = await db.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (rec) {
        await db.apiToken
          .update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } })
          .catch(() => {});
        return { id: rec.userId };
      }
    }
  }
  return getSessionUser();
}
