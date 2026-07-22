import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import {
  GEOMETRY_EPSILON,
  areOrthogonal,
  cross,
  isUnitVector,
  normalize,
  rotateAroundAxis,
  type Vec3,
} from "@/features/planning/domain/vector";

/**
 * A scan plane, described by a complete right-handed basis.
 *
 * A normal alone cannot say which way is horizontal or vertical in the plane,
 * so read and phase directions are carried explicitly. The invariant is
 * `normal = readDirection x phaseDirection`.
 *
 * In-plane rotation is baked into the basis by withInPlaneRotation rather than
 * stored alongside it, so the angle is never held in two places.
 */
export interface PlaneOrientation {
  normal: Vec3;
  /** In-plane horizontal axis (view u). */
  readDirection: Vec3;
  /** In-plane vertical axis (view v). */
  phaseDirection: Vec3;
}

// RAS: +x right, +y anterior, +z superior.
export const AXIAL: PlaneOrientation = {
  readDirection: { x: 1, y: 0, z: 0 },
  phaseDirection: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
};

/** The right-handed basis puts the coronal normal posterior. */
export const CORONAL: PlaneOrientation = {
  readDirection: { x: 1, y: 0, z: 0 },
  phaseDirection: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
};

export const SAGITTAL: PlaneOrientation = {
  readDirection: { x: 0, y: 1, z: 0 },
  phaseDirection: { x: 0, y: 0, z: 1 },
  normal: { x: 1, y: 0, z: 0 },
};

export const VIEW_ORIENTATION_BY_PLANE: Record<AnatomicalPlane, PlaneOrientation> = {
  axial: AXIAL,
  coronal: CORONAL,
  sagittal: SAGITTAL,
};

export function isOrthonormalOrientation(
  orientation: PlaneOrientation,
  epsilon: number = GEOMETRY_EPSILON
): boolean {
  const { normal, readDirection, phaseDirection } = orientation;
  if (!isUnitVector(normal, epsilon)) return false;
  if (!isUnitVector(readDirection, epsilon)) return false;
  if (!isUnitVector(phaseDirection, epsilon)) return false;
  if (!areOrthogonal(readDirection, phaseDirection, epsilon)) return false;
  if (!areOrthogonal(readDirection, normal, epsilon)) return false;
  if (!areOrthogonal(phaseDirection, normal, epsilon)) return false;

  // Right-handed: normal must be read x phase, not its opposite.
  const expected = cross(readDirection, phaseDirection);
  return (
    Math.abs(expected.x - normal.x) <= epsilon &&
    Math.abs(expected.y - normal.y) <= epsilon &&
    Math.abs(expected.z - normal.z) <= epsilon
  );
}

/**
 * Rebuilds a right-handed orthonormal basis from read and phase directions.
 * Returns null when the inputs are degenerate or parallel, rather than
 * inventing a direction.
 */
export function orthonormalize(
  readDirection: Vec3,
  phaseDirection: Vec3,
  epsilon: number = GEOMETRY_EPSILON
): PlaneOrientation | null {
  const read = normalize(readDirection, epsilon);
  if (!read) return null;

  const normal = normalize(cross(readDirection, phaseDirection), epsilon);
  if (!normal) return null; // parallel or degenerate inputs

  const phase = normalize(cross(normal, read), epsilon);
  if (!phase) return null;

  return { normal, readDirection: read, phaseDirection: phase };
}

/**
 * Rotates the in-plane axes around the plane normal.
 * Returns null when the orientation has no usable normal.
 */
export function withInPlaneRotation(
  orientation: PlaneOrientation,
  degrees: number
): PlaneOrientation | null {
  const read = rotateAroundAxis(orientation.readDirection, orientation.normal, degrees);
  const phase = rotateAroundAxis(orientation.phaseDirection, orientation.normal, degrees);
  if (!read || !phase) return null;
  return orthonormalize(read, phase);
}
