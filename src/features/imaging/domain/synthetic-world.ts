import type { VolumePosition } from "@/features/imaging/domain/volume-position";

/**
 * The physical extent an image source is treated as covering.
 *
 * Lets planning stay in world millimetres even for sources that carry no real
 * spatial metadata. Every millimetre-to-pixel conversion consumes a descriptor
 * rather than a shared constant, so different image sources can describe
 * themselves without changing the planning model.
 */
export interface SyntheticWorldDescriptor {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  center: VolumePosition;
}
