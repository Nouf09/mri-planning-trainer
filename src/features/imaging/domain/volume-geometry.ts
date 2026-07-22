import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import type { SyntheticWorldDescriptor } from "@/features/imaging/domain/synthetic-world";
import type { VolumePosition } from "@/features/imaging/domain/volume-position";

/** An axis-aligned region of the planning coordinate space. */
export interface WorldBounds {
  min: VolumePosition;
  max: VolumePosition;
}

/**
 * The physical geometry of a loaded image source.
 *
 * Coordinates are in the engine's orthogonal millimetre space, which is the
 * same space shared positions already use. That space is RAS-ordered and
 * axis-aligned, but obliquity has been removed from it, so it is deliberately
 * not labelled RAS. The rotation that separates it from true scanner
 * coordinates is reported in `obliquity` rather than discarded.
 */
export interface VolumeGeometry {
  dimensionsVox: { x: number; y: number; z: number };
  spacingMm: { x: number; y: number; z: number };
  bounds: WorldBounds;
  center: VolumePosition;
  obliquity: { angleDeg: number; maxShearDeg: number };
  coordinateSystem: "niivue-ortho-mm";
}

/** Orders two corners into a min/max pair, whichever way the axes run. */
export function normalizeBounds(a: VolumePosition, b: VolumePosition): WorldBounds {
  return {
    min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) },
    max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) },
  };
}

export function boundsCenter(bounds: WorldBounds): VolumePosition {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}

export function boundsSize(bounds: WorldBounds): { x: number; y: number; z: number } {
  return {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  };
}

export function boundsFromDescriptor(descriptor: SyntheticWorldDescriptor): WorldBounds {
  const { center, widthMm, heightMm, depthMm } = descriptor;
  return normalizeBounds(
    { x: center.x - widthMm / 2, y: center.y - heightMm / 2, z: center.z - depthMm / 2 },
    { x: center.x + widthMm / 2, y: center.y + heightMm / 2, z: center.z + depthMm / 2 }
  );
}

/**
 * Chooses the bounds planning should use for an image source.
 *
 * A synthetic descriptor describes the JPG assets only, so it is structurally
 * unreachable for any other engine: a real volume either supplies its own
 * geometry or planning has no bounds at all.
 */
export function resolvePlanningBounds(
  engineKind: ImagingEngineKind,
  geometry: VolumeGeometry | null,
  syntheticBounds: WorldBounds
): WorldBounds | null {
  if (engineKind === "jpg") return syntheticBounds;
  return geometry ? geometry.bounds : null;
}
