/** A mutable coordinate triple the reslicer reuses to avoid per-pixel allocation. */
export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * A volume the reslicer can sample, described without reference to any imaging
 * library.
 *
 * The sampler owns every storage concern: which affine is authoritative, how
 * voxels are ordered, and whether stored values need rescaling. The reslicer
 * makes no assumption about any of them.
 *
 * Intensities returned by `getVoxel` are final scalar values: any slope or
 * intercept has already been applied.
 */
export interface VolumeSampler {
  readonly volumeId: string;
  /** Voxel counts along the sampler's own x, y and z axes. */
  readonly dimensions: readonly [number, number, number];

  /**
   * Converts a world-millimetre point into voxel coordinates.
   *
   * Scalar in, written into `out`, so the innermost loop allocates nothing.
   * Returns false when the point has no voxel mapping at all; points that
   * simply fall outside the volume should still map, so the reslicer can apply
   * its own out-of-bounds policy.
   *
   * The reslicer owns `out` and reuses it, so implementations must not retain a
   * reference to it.
   */
  worldToVoxel(xMm: number, yMm: number, zMm: number, out: MutableVec3): boolean;

  /**
   * Intensity at integer voxel coordinates, or null when the coordinates fall
   * outside the volume.
   */
  getVoxel(x: number, y: number, z: number): number | null;
}
