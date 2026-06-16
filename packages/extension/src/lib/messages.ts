import type { FieldMap, StartupProfile } from "@aisas/shared/types";

export interface FillResult {
  mode: "map" | "heuristic";
  filled: Array<{ key: string; label: string }>;
  ambiguous: Array<{ key: string; label: string }>;
  skipped: number;
  total: number;
}

export interface FillRequest {
  type: "FILL_PAGE";
  profile: StartupProfile;
  fieldMap?: FieldMap | null;
}
export interface ScanRequest {
  type: "SCAN_PAGE";
}
export type Message = FillRequest | ScanRequest;
