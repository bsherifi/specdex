/** Zoom modes for the viewer. Numeric presets are absolute scales. */
export type ZoomMode =
  | { kind: "fit-width" }
  | { kind: "fit-page" }
  | { kind: "scale"; value: number };

/** Scale that makes a page of `pageW` (pt) fill `containerW` minus padding. */
export function fitWidthScale(containerW: number, pageW: number, padding: number): number {
  if (pageW <= 0) return 1;
  return Math.max(0.1, (containerW - padding) / pageW);
}

/** Scale that fits a whole page inside the container box (minus padding). */
export function fitPageScale(
  containerW: number,
  containerH: number,
  pageW: number,
  pageH: number,
  padding: number,
): number {
  if (pageW <= 0 || pageH <= 0) return 1;
  const sw = (containerW - padding) / pageW;
  const sh = (containerH - padding) / pageH;
  return Math.max(0.1, Math.min(sw, sh));
}

/** Resolve a zoom mode to a concrete scale given the container + first page. */
export function resolveScale(
  mode: ZoomMode,
  containerW: number,
  containerH: number,
  pageW: number,
  pageH: number,
  padding: number,
): number {
  switch (mode.kind) {
    case "fit-width":
      return fitWidthScale(containerW, pageW, padding);
    case "fit-page":
      return fitPageScale(containerW, containerH, pageW, pageH, padding);
    case "scale":
      return mode.value;
  }
}
