import type { ProjectedQuad } from "@/features/imaging/projection/quad";

/**
 * Pixel-space primitives handed to a renderer.
 *
 * Everything here is already in viewport coordinates: a renderer paints these
 * values directly and performs no geometry of its own.
 */

/**
 * How a slice group meets the camera plane.
 *
 * Descriptive only: every mode is produced by the same projection, so this
 * never selects a different geometric approximation.
 */
export type ProjectionMode = "face" | "edge" | "oblique";

/** How close to parallel or perpendicular counts as exactly so. */
export const ORTHOGONAL_TOLERANCE_DEG = 1;

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
}

export interface ProjectionResult {
  readonly mode: ProjectionMode;
  /** Outline of the centre slice; null when there is nothing to draw. */
  readonly outline: ProjectedQuad | null;
  /** One outline per slice, each the centre outline translated along the normal. */
  readonly sliceOutlines: readonly ProjectedQuad[];
  /** Pixels travelled per millimetre along the prescription normal. */
  readonly normalStepPx: ProjectedPoint;
  readonly outOfPlaneOffsetMm: number;
  readonly isVisible: boolean;
}

export const EMPTY_PROJECTION: ProjectionResult = Object.freeze({
  mode: "face" as const,
  outline: null,
  sliceOutlines: Object.freeze([]),
  normalStepPx: Object.freeze({ x: 0, y: 0 }),
  outOfPlaneOffsetMm: 0,
  isVisible: false,
});

function freezeQuad(quad: ProjectedQuad): ProjectedQuad {
  for (const corner of quad) Object.freeze(corner);
  return Object.freeze(quad) as ProjectedQuad;
}

/** Freezes a result so consumers cannot mutate shared projection state. */
export function freezeProjection(result: ProjectionResult): ProjectionResult {
  if (result.outline) freezeQuad(result.outline);
  for (const outline of result.sliceOutlines) freezeQuad(outline);
  Object.freeze(result.sliceOutlines);
  Object.freeze(result.normalStepPx);
  return Object.freeze(result);
}

/**
 * Classifies how the prescription meets the view, from the alignment of their
 * normals. Uses one named tolerance so the thresholds cannot drift apart.
 */
export function classifyProjectionMode(
  alignment: number,
  toleranceDeg: number = ORTHOGONAL_TOLERANCE_DEG
): ProjectionMode {
  if (!Number.isFinite(alignment)) return "oblique";
  const radians = (toleranceDeg * Math.PI) / 180;
  const clamped = Math.min(1, Math.abs(alignment));
  if (clamped >= Math.cos(radians)) return "face";
  if (clamped <= Math.sin(radians)) return "edge";
  return "oblique";
}
