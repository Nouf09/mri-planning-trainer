/**
 * Pixel-space primitives handed to a renderer.
 *
 * Everything here is already in viewport coordinates: a renderer paints these
 * values directly and performs no geometry of its own.
 */

/**
 * How a slice group meets the camera plane.
 *
 * "oblique" is reserved for arbitrary orientations and is not produced yet.
 */
export type ProjectionMode = "face" | "edge" | "oblique";

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
}

export interface ProjectedRectangle {
  readonly center: ProjectedPoint;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Rotation in screen coordinates, ready to pass to a canvas transform. */
  readonly rotationRad: number;
}

/** A slice group seen from the side, so its stacking depth is visible. */
export interface ProjectedSlab extends ProjectedRectangle {
  readonly thicknessPx: number;
}

export interface ProjectedSliceLine {
  readonly start: ProjectedPoint;
  readonly end: ProjectedPoint;
}

export interface ProjectionResult {
  readonly mode: ProjectionMode;
  /** Present when the camera looks along the slice normal. */
  readonly rectangle: ProjectedRectangle | null;
  /** Present when the camera looks across the slice normal. */
  readonly slab: ProjectedSlab | null;
  readonly sliceLines: readonly ProjectedSliceLine[];
  readonly outOfPlaneOffsetMm: number;
  /** False when the projection has nothing meaningful to draw. */
  readonly isVisible: boolean;
}

export const EMPTY_PROJECTION: ProjectionResult = Object.freeze({
  mode: "face" as const,
  rectangle: null,
  slab: null,
  sliceLines: Object.freeze([]),
  outOfPlaneOffsetMm: 0,
  isVisible: false,
});

/** Freezes a result so consumers cannot mutate shared projection state. */
export function freezeProjection(result: ProjectionResult): ProjectionResult {
  if (result.rectangle) {
    Object.freeze(result.rectangle.center);
    Object.freeze(result.rectangle);
  }
  if (result.slab) {
    Object.freeze(result.slab.center);
    Object.freeze(result.slab);
  }
  for (const line of result.sliceLines) {
    Object.freeze(line.start);
    Object.freeze(line.end);
    Object.freeze(line);
  }
  Object.freeze(result.sliceLines);
  return Object.freeze(result);
}
