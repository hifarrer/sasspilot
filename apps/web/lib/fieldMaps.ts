import type { DiscoveredBy, FieldMap, FieldMapEntry } from "@aisas/shared/types";
import { db } from "./db";

interface FieldMapRow {
  directoryId: string;
  version: number;
  fieldsJson: string;
  discoveredBy: string;
  confidence: number;
  lastVerifiedAt: Date | null;
}

function shape(fm: FieldMapRow, domain: string): FieldMap {
  let fields: FieldMapEntry[] = [];
  try {
    const parsed = JSON.parse(fm.fieldsJson);
    if (Array.isArray(parsed)) fields = parsed;
  } catch {
    // leave empty
  }
  return {
    directoryId: fm.directoryId,
    domain,
    version: fm.version,
    fields,
    discoveredBy: fm.discoveredBy as DiscoveredBy,
    confidence: fm.confidence,
    lastVerifiedAt: fm.lastVerifiedAt ? fm.lastVerifiedAt.toISOString() : null,
  };
}

/** Latest curated field map for a domain (used by the extension), or null. */
export async function getFieldMapByDomain(domain: string): Promise<FieldMap | null> {
  const dir = await db.directory.findFirst({
    where: { domain },
    include: { fieldMaps: { orderBy: { version: "desc" }, take: 1 } },
  });
  const fm = dir?.fieldMaps[0];
  if (!dir || !fm) return null;
  return shape(fm, dir.domain);
}

export async function getFieldMapByDirectory(directoryId: string): Promise<FieldMap | null> {
  const dir = await db.directory.findUnique({
    where: { id: directoryId },
    include: { fieldMaps: { orderBy: { version: "desc" }, take: 1 } },
  });
  const fm = dir?.fieldMaps[0];
  if (!dir || !fm) return null;
  return shape(fm, dir.domain);
}
