import type { KbColorName } from "@/lib/theme";

export interface Match {
  entry_id: string;
  kb_id: string;
  pattern_source: "primary" | "alias";
  matched_text: string;
  start_offset: number;
  end_offset: number;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface KbScope {
  kind: "all" | "only";
  kb_id?: string;
}

export interface KbColorMap {
  [kbId: string]: { name: string; color: KbColorName | undefined; hex: string };
}

export interface SelectionCapture {
  text: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
}

/** Mirrors core `FindMatch` — a literal find-in-document hit. */
export interface FindMatch {
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  context: string;
  start_offset: number;
  end_offset: number;
}
