import type { MutableVec3, VolumeSampler } from "@/features/imaging/reslice/volume-sampler";

/**
 * Synthetic volumes used to prove reslicing numerically.
 *
 * Test support only: nothing here is used by production code. Values encode
 * position, so an axis swap, a mirror or a half-voxel shift changes the decoded
 * number rather than merely looking wrong.
 */

export interface SyntheticVolumeOptions {
  readonly volumeId?: string;
  /** Deliberately unequal, so a transposed axis is detectable. */
  readonly dimensions?: readonly [number, number, number];
  /** Millimetres per voxel along each axis. */
  readonly spacing?: readonly [number, number, number];
  /** World position of voxel (0, 0, 0). */
  readonly origin?: readonly [number, number, number];
  /** Negative entries mirror that axis, giving a negative determinant. */
  readonly axisSign?: readonly [1 | -1, 1 | -1, 1 | -1];
}

interface ResolvedOptions {
  volumeId: string;
  dimensions: readonly [number, number, number];
  spacing: readonly [number, number, number];
  origin: readonly [number, number, number];
  axisSign: readonly [number, number, number];
}

function resolve(options: SyntheticVolumeOptions): ResolvedOptions {
  return {
    volumeId: options.volumeId ?? "synthetic",
    dimensions: options.dimensions ?? [5, 7, 3],
    spacing: options.spacing ?? [1, 1, 1],
    origin: options.origin ?? [0, 0, 0],
    axisSign: options.axisSign ?? [1, 1, 1],
  };
}

/** Inverts world = origin + sign * voxel * spacing. */
function makeWorldToVoxel(resolved: ResolvedOptions) {
  return (xMm: number, yMm: number, zMm: number, out: MutableVec3): boolean => {
    if (!Number.isFinite(xMm) || !Number.isFinite(yMm) || !Number.isFinite(zMm)) return false;
    out.x = ((xMm - resolved.origin[0]) / resolved.spacing[0]) * resolved.axisSign[0];
    out.y = ((yMm - resolved.origin[1]) / resolved.spacing[1]) * resolved.axisSign[1];
    out.z = ((zMm - resolved.origin[2]) / resolved.spacing[2]) * resolved.axisSign[2];
    return true;
  };
}

/** World position of a voxel centre, for building expectations in tests. */
export function voxelToWorld(
  options: SyntheticVolumeOptions,
  x: number,
  y: number,
  z: number
): { x: number; y: number; z: number } {
  const r = resolve(options);
  return {
    x: r.origin[0] + x * r.spacing[0] * r.axisSign[0],
    y: r.origin[1] + y * r.spacing[1] * r.axisSign[1],
    z: r.origin[2] + z * r.spacing[2] * r.axisSign[2],
  };
}

/** Encoded value at a voxel: x, y and z each read back unambiguously. */
export function encodeCoordinate(x: number, y: number, z: number): number {
  return x * 10000 + y * 100 + z;
}

export function decodeCoordinate(value: number): { x: number; y: number; z: number } {
  const x = Math.floor(value / 10000);
  const y = Math.floor((value - x * 10000) / 100);
  const z = value - x * 10000 - y * 100;
  return { x, y, z };
}

/** Marker intensity, far from any encoded coordinate value. */
export const MARKER_VALUE = 999999;

export interface CoordinateVolumeOptions extends SyntheticVolumeOptions {
  /** Places a distinctive value at one corner, so mirroring is detectable. */
  readonly markerAt?: readonly [number, number, number];
}

/** A volume whose every voxel encodes its own index. */
export function createCoordinateVolume(options: CoordinateVolumeOptions = {}): VolumeSampler {
  const resolved = resolve(options);
  const [dimX, dimY, dimZ] = resolved.dimensions;
  const marker = options.markerAt;

  return {
    volumeId: resolved.volumeId,
    dimensions: [dimX, dimY, dimZ],
    worldToVoxel: makeWorldToVoxel(resolved),
    getVoxel(x, y, z) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return null;
      if (x < 0 || y < 0 || z < 0 || x >= dimX || y >= dimY || z >= dimZ) return null;
      if (marker && x === marker[0] && y === marker[1] && z === marker[2]) return MARKER_VALUE;
      return encodeCoordinate(x, y, z);
    },
  };
}

export interface GradientVolumeOptions extends SyntheticVolumeOptions {
  /** value = a*x + b*y + c*z + d, in voxel coordinates. */
  readonly a?: number;
  readonly b?: number;
  readonly c?: number;
  readonly d?: number;
}

/**
 * A volume that is linear in voxel coordinates.
 *
 * Trilinear interpolation reproduces a linear field exactly, so any sampled
 * value can be checked against the analytic expression.
 */
export function createGradientVolume(options: GradientVolumeOptions = {}): VolumeSampler {
  const resolved = resolve(options);
  const [dimX, dimY, dimZ] = resolved.dimensions;
  const a = options.a ?? 1;
  const b = options.b ?? 10;
  const c = options.c ?? 100;
  const d = options.d ?? 5;

  return {
    volumeId: resolved.volumeId,
    dimensions: [dimX, dimY, dimZ],
    worldToVoxel: makeWorldToVoxel(resolved),
    getVoxel(x, y, z) {
      if (x < 0 || y < 0 || z < 0 || x >= dimX || y >= dimY || z >= dimZ) return null;
      return a * x + b * y + c * z + d;
    },
  };
}

/** The analytic value the gradient volume holds at continuous voxel coordinates. */
export function gradientValueAt(
  options: GradientVolumeOptions,
  x: number,
  y: number,
  z: number
): number {
  const a = options.a ?? 1;
  const b = options.b ?? 10;
  const c = options.c ?? 100;
  const d = options.d ?? 5;
  return a * x + b * y + c * z + d;
}
