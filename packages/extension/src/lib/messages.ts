import type { FieldMap, StartupProfile } from "@aisas/shared/types";

export interface FillResult {
  mode: "map" | "heuristic";
  filled: Array<{ key: string; label: string }>;
  ambiguous: Array<{ key: string; label: string }>;
  skipped: number;
  total: number;
}

/** A still-empty field discovered on the page, sent to the AI to be filled. */
export interface EmptyField {
  id: string;
  label?: string;
  name?: string;
  placeholder?: string;
  type: string;
  tag: string;
  maxLength?: number | null;
  classifiedKey?: string | null;
  /** For selects / radio groups: the available option labels to choose from. */
  options?: string[];
}

/** An AI-generated value to apply to a tagged field. */
export interface FieldValue {
  id: string;
  value: string;
}

export interface AiFillResult {
  filled: number;
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
export interface ScanEmptyRequest {
  type: "SCAN_EMPTY";
}
export interface FillFieldsRequest {
  type: "FILL_FIELDS";
  values: FieldValue[];
}
export type Message = FillRequest | ScanRequest | ScanEmptyRequest | FillFieldsRequest;
