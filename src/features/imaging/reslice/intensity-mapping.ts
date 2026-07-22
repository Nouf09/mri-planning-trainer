import type { ReslicedSlice } from "@/features/imaging/reslice/reslice-volume";

/** The intensity range that maps onto the full grey ramp. */
export interface IntensityWindow {
  readonly min: number;
  readonly max: number;
}

/** Grey bytes plus the alpha carried through from sampling. */
export interface GrayscaleImage {
  readonly width: number;
  readonly height: number;
  readonly gray: Uint8ClampedArray;
  readonly alpha: Uint8Array;
}

export type IntensityMappingOutcome =
  | { readonly status: "ok"; readonly image: GrayscaleImage }
  | { readonly status: "invalid-window"; readonly reason: string };

/**
 * Maps sampled intensities onto a linear grey ramp.
 *
 * The window is supplied by the caller: this phase derives no window of its
 * own, so there is no percentile logic and no clinical preset here. Alpha is
 * carried through untouched, keeping "outside the volume" distinct from "dark".
 */
export function toGrayscale(
  slice: ReslicedSlice,
  intensityWindow: IntensityWindow
): IntensityMappingOutcome {
  if (!Number.isFinite(intensityWindow.min) || !Number.isFinite(intensityWindow.max)) {
    return { status: "invalid-window", reason: "window bounds must be finite" };
  }
  if (intensityWindow.max <= intensityWindow.min) {
    return { status: "invalid-window", reason: "window max must be greater than window min" };
  }

  const count = slice.width * slice.height;
  const gray = new Uint8ClampedArray(count);
  const alpha = new Uint8Array(count);
  const span = intensityWindow.max - intensityWindow.min;

  for (let index = 0; index < count; index++) {
    alpha[index] = slice.alpha[index];
    if (slice.alpha[index] === 0) {
      gray[index] = 0;
      continue;
    }

    const value = slice.intensities[index];
    if (!Number.isFinite(value)) {
      gray[index] = 0;
      continue;
    }

    const normalized = (value - intensityWindow.min) / span;
    gray[index] = Math.round(Math.min(Math.max(normalized, 0), 1) * 255);
  }

  return { status: "ok", image: { width: slice.width, height: slice.height, gray, alpha } };
}
