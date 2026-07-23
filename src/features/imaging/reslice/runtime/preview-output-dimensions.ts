/** Longest output axis for a preview, in pixels. */
export const OBLIQUE_PREVIEW_MAX_PX = 256;

export interface PreviewDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Output matrix that preserves the prescription's physical field-of-view ratio.
 *
 * The longer physical axis fills OBLIQUE_PREVIEW_MAX_PX and the shorter one is
 * scaled proportionally, so anatomy is never stretched. No axis falls below 1.
 * Returns null for a non-positive or non-finite field of view.
 */
export function previewOutputDimensions(
  fovReadMm: number,
  fovPhaseMm: number,
  maxPx: number = OBLIQUE_PREVIEW_MAX_PX
): PreviewDimensions | null {
  if (!Number.isFinite(fovReadMm) || !Number.isFinite(fovPhaseMm)) return null;
  if (fovReadMm <= 0 || fovPhaseMm <= 0) return null;

  const aspect = fovReadMm / fovPhaseMm;
  if (aspect >= 1) {
    return { width: maxPx, height: Math.max(1, Math.round(maxPx / aspect)) };
  }
  return { width: Math.max(1, Math.round(maxPx * aspect)), height: maxPx };
}
