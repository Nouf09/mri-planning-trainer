import type { ProjectedPoint } from "@/features/imaging/projection/projection-model";

/**
 * Four ordered corners in viewport pixels.
 *
 * A rectangular prescription seen from another plane is a parallelogram, so a
 * width, a height and an angle cannot describe it. Corners can.
 */
export type ProjectedQuad = readonly [
  ProjectedPoint,
  ProjectedPoint,
  ProjectedPoint,
  ProjectedPoint,
];

/** Below this area a quad is treated as collapsed rather than enclosing. */
export const MIN_QUAD_AREA_PX = 1e-6;

export function isFinitePoint(point: ProjectedPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isFiniteQuad(quad: ProjectedQuad): boolean {
  return quad.every(isFinitePoint);
}

export function quadCenter(quad: ProjectedQuad): ProjectedPoint {
  return {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  };
}

/** Unsigned area, via the shoelace formula. Zero when the quad is edge-on. */
export function quadArea(quad: ProjectedQuad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const current = quad[i];
    const next = quad[(i + 1) % 4];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

/** Largest distance between any two corners; zero only for a collapsed point. */
export function quadExtent(quad: ProjectedQuad): number {
  let largest = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      largest = Math.max(largest, Math.hypot(quad[i].x - quad[j].x, quad[i].y - quad[j].y));
    }
  }
  return largest;
}

export function isDegenerateQuad(quad: ProjectedQuad, minArea = MIN_QUAD_AREA_PX): boolean {
  return !isFiniteQuad(quad) || quadArea(quad) <= minArea;
}

/** Midpoint of the edge leaving corner `edgeIndex`. */
export function quadEdgeMidpoint(quad: ProjectedQuad, edgeIndex: number): ProjectedPoint {
  const start = quad[edgeIndex % 4];
  const end = quad[(edgeIndex + 1) % 4];
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/**
 * Unit normal of an edge, pointing away from the quad's centre.
 * Returns null when the edge has no length.
 */
export function quadOutwardNormal(
  quad: ProjectedQuad,
  edgeIndex: number
): ProjectedPoint | null {
  const start = quad[edgeIndex % 4];
  const end = quad[(edgeIndex + 1) % 4];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return null;

  const candidate = { x: -dy / length, y: dx / length };
  const midpoint = quadEdgeMidpoint(quad, edgeIndex);
  const center = quadCenter(quad);
  const outward =
    (midpoint.x - center.x) * candidate.x + (midpoint.y - center.y) * candidate.y >= 0;
  return outward ? candidate : { x: -candidate.x, y: -candidate.y };
}

/**
 * The edge highest on screen, chosen deterministically so the renderer and hit
 * testing place the rotate handle in the same spot.
 */
export function topEdgeIndex(quad: ProjectedQuad): number {
  let best = 0;
  let bestY = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 4; i++) {
    const y = quadEdgeMidpoint(quad, i).y;
    if (y < bestY - 1e-9) {
      bestY = y;
      best = i;
    }
  }
  return best;
}

/** Distance to the nearest corner, with its index. */
export function nearestCorner(
  point: ProjectedPoint,
  quad: ProjectedQuad
): { index: number; distance: number } {
  let index = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 4; i++) {
    const candidate = Math.hypot(point.x - quad[i].x, point.y - quad[i].y);
    if (candidate < distance) {
      distance = candidate;
      index = i;
    }
  }
  return { index, distance };
}

/**
 * Whether a point lies inside a convex quad.
 *
 * Uses consistent edge cross-product signs, so it holds for any winding and any
 * rotation. A collapsed quad encloses nothing.
 */
export function pointInConvexQuad(point: ProjectedPoint, quad: ProjectedQuad): boolean {
  if (!isFinitePoint(point) || isDegenerateQuad(quad)) return false;

  let sawPositive = false;
  let sawNegative = false;
  for (let i = 0; i < 4; i++) {
    const start = quad[i];
    const end = quad[(i + 1) % 4];
    const cross =
      (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
    if (cross > 0) sawPositive = true;
    if (cross < 0) sawNegative = true;
    if (sawPositive && sawNegative) return false;
  }
  return true;
}
