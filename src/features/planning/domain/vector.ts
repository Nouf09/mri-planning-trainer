/** Tolerance for geometry comparisons, in the units of the value being compared. */
export const GEOMETRY_EPSILON = 1e-6;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, factor: number): Vec3 {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

/**
 * Returns the unit vector, or null when the input has no direction.
 *
 * Degenerate input is reported rather than repaired: callers decide what a
 * directionless orientation should mean.
 */
export function normalize(v: Vec3, epsilon: number = GEOMETRY_EPSILON): Vec3 | null {
  const magnitude = length(v);
  if (!Number.isFinite(magnitude) || magnitude <= epsilon) return null;
  return scale(v, 1 / magnitude);
}

export function isUnitVector(v: Vec3, epsilon: number = GEOMETRY_EPSILON): boolean {
  return Math.abs(length(v) - 1) <= epsilon;
}

export function areOrthogonal(a: Vec3, b: Vec3, epsilon: number = GEOMETRY_EPSILON): boolean {
  return Math.abs(dot(a, b)) <= epsilon;
}

export function areVectorsEqual(a: Vec3, b: Vec3, epsilon: number = GEOMETRY_EPSILON): boolean {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon
  );
}

/**
 * Rotates a vector around a unit axis (Rodrigues' rotation formula).
 * Returns null when the axis has no direction.
 */
export function rotateAroundAxis(v: Vec3, axis: Vec3, degrees: number): Vec3 | null {
  const unitAxis = normalize(axis);
  if (!unitAxis) return null;

  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const parallel = scale(unitAxis, dot(unitAxis, v) * (1 - cos));
  const rotated = add(scale(v, cos), scale(cross(unitAxis, v), sin));
  return add(rotated, parallel);
}
