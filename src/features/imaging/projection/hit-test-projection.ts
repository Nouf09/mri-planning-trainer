import type {
  ProjectedPoint,
  ProjectionResult,
} from "@/features/imaging/projection/projection-model";
import {
  isFinitePoint,
  nearestCorner,
  pointInConvexQuad,
  quadEdgeMidpoint,
  quadOutwardNormal,
  topEdgeIndex,
  type ProjectedQuad,
} from "@/features/imaging/projection/quad";

/** Which part of a prescription a pointer is over. */
export type PrescriptionHandle = "move" | "resize" | "rotate" | null;

/** Grab radius for corner and rotate handles. */
export const HANDLE_RADIUS_PX = 12;
/** Distance the rotate knob sits beyond the chosen edge. */
export const ROTATE_STALK_PX = 20;

export interface HitTestOptions {
  handleRadiusPx?: number;
  rotateStalkPx?: number;
}

/**
 * Where the rotate knob sits for a projected outline.
 *
 * Shared with the renderer so the drawn knob and the grabbable knob are the
 * same point by construction.
 */
export function rotateKnobPosition(
  quad: ProjectedQuad,
  stalkPx: number = ROTATE_STALK_PX
): ProjectedPoint | null {
  const edge = topEdgeIndex(quad);
  const outward = quadOutwardNormal(quad, edge);
  if (!outward) return null;
  const midpoint = quadEdgeMidpoint(quad, edge);
  return { x: midpoint.x + outward.x * stalkPx, y: midpoint.y + outward.y * stalkPx };
}

/**
 * Hit-tests the geometry that was actually drawn.
 *
 * Working from the projected outline keeps the interactive regions identical to
 * the painted ones, whatever the prescription's orientation.
 */
export function hitTestProjection(
  point: ProjectedPoint,
  projection: ProjectionResult,
  options: HitTestOptions = {}
): PrescriptionHandle {
  if (!projection.isVisible) return null;

  const outline = projection.outline;
  if (outline === null) return null;
  if (!isFinitePoint(point)) return null;

  const handleRadius = options.handleRadiusPx ?? HANDLE_RADIUS_PX;
  const stalk = options.rotateStalkPx ?? ROTATE_STALK_PX;

  const knob = rotateKnobPosition(outline, stalk);
  if (knob && Math.hypot(point.x - knob.x, point.y - knob.y) < handleRadius) return "rotate";

  if (nearestCorner(point, outline).distance < handleRadius) return "resize";

  return pointInConvexQuad(point, outline) ? "move" : null;
}
