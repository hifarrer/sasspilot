import { type NextRequest, NextResponse } from "next/server";
import { listDirectories, type DirectoryQuery } from "@/lib/directories";

export const dynamic = "force-dynamic";

/** Public, read-only directory listing — also consumed by the extension. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);

  const result = await listDirectories({
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    cost: sp.get("cost") ?? undefined,
    backlink: sp.get("backlink") ?? undefined,
    minDR: num("minDR"),
    page: num("page"),
    pageSize: num("pageSize"),
    sort: (sp.get("sort") as DirectoryQuery["sort"]) ?? undefined,
  });

  return NextResponse.json(result, {
    headers: { "access-control-allow-origin": "*" },
  });
}
