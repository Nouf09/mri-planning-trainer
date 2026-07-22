import type { VolumeSampler } from "@/features/imaging/reslice/volume-sampler";

/**
 * Voxel sampling in continuous coordinates.
 *
 * A voxel's centre sits at its integer index, so valid continuous coordinates
 * span [0, dimension - 1]. Coordinates are never wrapped: a sample outside the
 * volume is either reported as absent or clamped, according to the caller's
 * policy.
 */

const clampToRange = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/**
 * Nearest-neighbour sampling.
 *
 * Rounding uses Math.round, so an exact .5 fraction resolves toward +infinity
 * on every axis. Bounds are checked after rounding, which keeps the half-open
 * voxel footprint correct: -0.4 belongs to voxel 0, while -0.6 lies outside.
 */
export function sampleNearest(
  sampler: VolumeSampler,
  x: number,
  y: number,
  z: number,
  clamp: boolean
): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  const [dimX, dimY, dimZ] = sampler.dimensions;
  let ix = Math.round(x);
  let iy = Math.round(y);
  let iz = Math.round(z);

  if (clamp) {
    ix = clampToRange(ix, dimX - 1);
    iy = clampToRange(iy, dimY - 1);
    iz = clampToRange(iz, dimZ - 1);
  } else if (ix < 0 || iy < 0 || iz < 0 || ix > dimX - 1 || iy > dimY - 1 || iz > dimZ - 1) {
    return null;
  }

  return sampler.getVoxel(ix, iy, iz);
}

/**
 * Trilinear sampling over the eight surrounding voxels.
 *
 * The upper neighbour is capped at the last voxel index rather than treated as
 * out of bounds: at an exact upper edge the fractional weight is zero, so the
 * capped neighbour contributes nothing and the result stays exact.
 *
 * Interpolation runs x first, then y, then z, in that fixed order.
 */
export function sampleTrilinear(
  sampler: VolumeSampler,
  x: number,
  y: number,
  z: number,
  clamp: boolean
): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  const [dimX, dimY, dimZ] = sampler.dimensions;
  const maxX = dimX - 1;
  const maxY = dimY - 1;
  const maxZ = dimZ - 1;

  let sx = x;
  let sy = y;
  let sz = z;

  if (clamp) {
    sx = clampToRange(sx, maxX);
    sy = clampToRange(sy, maxY);
    sz = clampToRange(sz, maxZ);
  } else if (sx < 0 || sy < 0 || sz < 0 || sx > maxX || sy > maxY || sz > maxZ) {
    return null;
  }

  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const z0 = Math.floor(sz);
  const fx = sx - x0;
  const fy = sy - y0;
  const fz = sz - z0;

  const x1 = Math.min(x0 + 1, maxX);
  const y1 = Math.min(y0 + 1, maxY);
  const z1 = Math.min(z0 + 1, maxZ);

  const c000 = sampler.getVoxel(x0, y0, z0);
  const c100 = sampler.getVoxel(x1, y0, z0);
  const c010 = sampler.getVoxel(x0, y1, z0);
  const c110 = sampler.getVoxel(x1, y1, z0);
  const c001 = sampler.getVoxel(x0, y0, z1);
  const c101 = sampler.getVoxel(x1, y0, z1);
  const c011 = sampler.getVoxel(x0, y1, z1);
  const c111 = sampler.getVoxel(x1, y1, z1);
  if (
    c000 === null || c100 === null || c010 === null || c110 === null ||
    c001 === null || c101 === null || c011 === null || c111 === null
  ) {
    return null;
  }

  const c00 = c000 + (c100 - c000) * fx;
  const c10 = c010 + (c110 - c010) * fx;
  const c01 = c001 + (c101 - c001) * fx;
  const c11 = c011 + (c111 - c011) * fx;

  const c0 = c00 + (c10 - c00) * fy;
  const c1 = c01 + (c11 - c01) * fy;

  const value = c0 + (c1 - c0) * fz;
  return Number.isFinite(value) ? value : null;
}
