import { KB_HIGHLIGHT_COLORS } from "../../tailwind.config";

export type KbColorName = keyof typeof KB_HIGHLIGHT_COLORS;
export const KB_COLOR_NAMES = Object.keys(KB_HIGHLIGHT_COLORS) as KbColorName[];
export const KB_COLOR_HEX: Record<KbColorName, string> = KB_HIGHLIGHT_COLORS;

/**
 * Picks the next color in the palette given how many KBs already exist.
 * Used on KB create when the user doesn't choose a color (§25 default).
 */
export function defaultKbColor(existingKbCount: number): KbColorName {
  return KB_COLOR_NAMES[existingKbCount % KB_COLOR_NAMES.length]!;
}
