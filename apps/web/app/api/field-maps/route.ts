import { type NextRequest, NextResponse } from "next/server";
import { getFieldMapByDomain } from "@/lib/fieldMaps";

export const dynamic = "force-dynamic";

/** Public: latest curated field map for a domain. Consumed by the extension. */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "domain query param required" }, { status: 400 });
  }
  const fieldMap = await getFieldMapByDomain(domain.replace(/^www\./, ""));
  return NextResponse.json({ fieldMap }, { headers: { "access-control-allow-origin": "*" } });
}
