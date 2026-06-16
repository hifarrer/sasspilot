import { NextResponse } from "next/server";
import { getFieldMapByDirectory } from "@/lib/fieldMaps";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ directoryId: string }> }) {
  const { directoryId } = await params;
  const fieldMap = await getFieldMapByDirectory(directoryId);
  return NextResponse.json({ fieldMap }, { headers: { "access-control-allow-origin": "*" } });
}
