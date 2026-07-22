import type { SyntheticWorldDescriptor } from "@/features/imaging/domain/synthetic-world";

/**
 * Educational calibration for the bundled brain JPG images.
 *
 * These images carry no spatial metadata, so this is a documented teaching
 * approximation of adult head coverage, not measured anatomy. It applies only
 * to the JPG image source: a real volume must report its own geometry, and this
 * descriptor is never applied to one.
 */
export const BRAIN_SYNTHETIC_WORLD: SyntheticWorldDescriptor = {
  widthMm: 300,
  heightMm: 300,
  depthMm: 300,
  center: { x: 0, y: 0, z: 0 },
};
