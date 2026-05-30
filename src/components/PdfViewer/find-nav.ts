/**
 * Cycle a 0-based match index by `delta`, wrapping within `[0, count)`.
 * A null current jumps to the first (forward) or last (backward) match.
 */
export function stepIndex(current: number | null, count: number, delta: number): number | null {
  if (count <= 0) return null;
  if (current === null) return delta >= 0 ? 0 : count - 1;
  return (((current + delta) % count) + count) % count;
}
