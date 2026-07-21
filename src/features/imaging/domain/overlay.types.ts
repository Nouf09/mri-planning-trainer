/**
 * Geometry required to draw and hit-test planning overlays.
 *
 * Owned by the imaging feature so the overlay layer stays independent of the
 * planning domain. Callers map their own state into this shape.
 */
export interface PlanningGeometry {
  /** Normalized viewport centre, 0..1. */
  centerX: number;
  /** Normalized viewport centre, 0..1. */
  centerY: number;
  fovRead: number;
  fovPhase: number;
  /** Degrees. */
  angulation: number;
  sliceCount: number;
  sliceThickness: number;
  sliceGap: number;
}
