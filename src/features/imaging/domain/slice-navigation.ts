import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";

/** Voxel axis stepped when scrolling through slices of a given plane. */
export type SliceAxis = "x" | "y" | "z";

export const SLICE_AXIS_BY_PLANE: Record<AnatomicalPlane, SliceAxis> = {
  sagittal: "x",
  coronal: "y",
  axial: "z",
};

/** Wheel movement, in pixels, that advances the volume by one slice. */
export const WHEEL_STEP_THRESHOLD_PX = 100;

/** Approximations used to bring line- and page-mode wheel events into pixels. */
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 100;

/**
 * Brings a wheel event's delta into pixel units.
 *
 * Browsers report wheel movement in pixels (0), lines (1) or pages (2).
 */
export function normalizeWheelDeltaY(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * LINE_HEIGHT_PX;
  if (deltaMode === 2) return deltaY * PAGE_HEIGHT_PX;
  return deltaY;
}

export interface WheelStepResult {
  /** Whole slices to step. Positive advances toward higher voxel indices. */
  steps: number;
  /** Movement left over, to be carried into the next event. */
  carry: number;
}

/**
 * Converts accumulated wheel movement into whole slice steps.
 *
 * Accumulating rather than stepping per event keeps trackpad inertia, which
 * fires many small deltas, from racing through the volume.
 *
 * Scrolling up (negative deltaY) advances toward higher voxel indices.
 */
export function sliceStepsFromWheel(
  carry: number,
  deltaY: number,
  threshold: number = WHEEL_STEP_THRESHOLD_PX
): WheelStepResult {
  const total = carry + deltaY;
  const consumed = Math.trunc(total / threshold);
  // Guard against negative zero, so callers can compare against 0 safely.
  const steps = consumed === 0 ? 0 : -consumed;
  return { steps, carry: total - consumed * threshold };
}

/**
 * Voxel-space delta that steps the given plane's axis.
 *
 * Assumes the volume's voxel axes are ordered x, y, z, which holds for the
 * RAS-oriented volumes this trainer loads.
 */
export function voxelDeltaForPlane(
  plane: AnatomicalPlane,
  steps: number
): [number, number, number] {
  switch (SLICE_AXIS_BY_PLANE[plane]) {
    case "x":
      return [steps, 0, 0];
    case "y":
      return [0, steps, 0];
    default:
      return [0, 0, steps];
  }
}
