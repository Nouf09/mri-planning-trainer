import type {
  ProjectedPoint,
  ProjectedRectangle,
  ProjectionResult,
} from "@/features/imaging/projection/projection-model";

/** Which part of a prescription a pointer is over. */
export type PrescriptionHandle = "move" | "resize" | "rotate" | null;

/** Grab radius for corner and rotate handles. */
export const HANDLE_RADIUS_PX = 12;
/** Distance the rotate knob sits beyond the top edge. */
export const ROTATE_STALK_PX = 20;

export interface HitTestOptions {
  handleRadiusPx?: number;
  rotateStalkPx?: number;
}

/** Brings a viewport point into a shape's own rotated frame. */
function toShapeLocal(point: ProjectedPoint, shape: ProjectedRectangle): ProjectedPoint {
  const dx = point.x - shape.center.x;
  const dy = point.y - shape.center.y;
  const cos = Math.cos(-shape.rotationRad);
  const sin = Math.sin(-shape.rotationRad);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/**
 * Hit-tests the geometry that was actually drawn.
 *
 * Working from the projection rather than from planning state keeps the
 * interactive regions identical to the painted ones: both come from the same
 * projected pixels, so they cannot drift apart.
 */
export function hitTestProjection(
  point: ProjectedPoint,
  projection: ProjectionResult,
  options: HitTestOptions = {}
): PrescriptionHandle {
  if (!projection.isVisible) return null;

  const shape: ProjectedRectangle | null = projection.rectangle ?? projection.slab;
  if (!shape) return null;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  const handleRadius = options.handleRadiusPx ?? HANDLE_RADIUS_PX;
  const stalk = options.rotateStalkPx ?? ROTATE_STALK_PX;

  const local = toShapeLocal(point, shape);
  const halfWidth = shape.widthPx / 2;
  const halfHeight = shape.heightPx / 2;

  if (Math.hypot(local.x, local.y - (-halfHeight - stalk)) < handleRadius) return "rotate";

  const corners: Array<[number, number]> = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ];
  for (const [cornerX, cornerY] of corners) {
    if (Math.hypot(local.x - cornerX, local.y - cornerY) < handleRadius) return "resize";
  }

  if (Math.abs(local.x) < halfWidth && Math.abs(local.y) < halfHeight) return "move";
  return null;
}
