import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import type { MutableVec3, VolumeSampler } from "@/features/imaging/reslice/volume-sampler";

/**
 * Largest source-acquisition tilt this adapter will sample.
 *
 * The adapter samples in Niivue's orthogonal millimetre frame, which is true
 * scanner RAS with the acquisition tilt removed. This bounds how far that frame
 * may diverge from true RAS. It is an entirely separate concern from
 * ORTHOGONAL_TOLERANCE_DEG, which classifies a prescription plane against a
 * viewport; the two must never share a symbol even if their values coincide.
 */
export const MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG = 1.0;

/**
 * Largest voxel-grid shear this adapter will sample.
 *
 * Shear measures rhomboidal (non-orthogonal) voxel geometry, a different
 * pathology from acquisition tilt, so it is gated independently: a change to
 * one threshold must not affect the other.
 */
export const MAX_SUPPORTED_SOURCE_SHEAR_DEG = 0.1;

/**
 * The Niivue image surface this adapter reads.
 *
 * Declared structurally so NVImage never leaks past the adapter, and so the
 * unit tests can drive it without constructing a real volume.
 */
export interface NiivueImageLike {
  /** Column-major mat4 mapping fractional coordinates to orthogonal mm. */
  frac2mmOrtho?: ArrayLike<number>;
  /** Intensity at RAS voxel indices, already permuted and rescaled by Niivue. */
  getValue(x: number, y: number, z: number): number;
}

export interface NiivueSamplerInput {
  readonly volumeId: string;
  readonly image: NiivueImageLike;
  readonly geometry: VolumeGeometry;
}

export type NiivueSamplerCreationResult =
  | { readonly status: "ready"; readonly sampler: VolumeSampler }
  | {
      readonly status: "unsupported";
      readonly reason: "source-volume-obliquity";
      readonly measuredAngleDeg: number;
      readonly maximumSupportedAngleDeg: number;
    }
  | {
      readonly status: "unsupported";
      readonly reason: "source-volume-shear";
      readonly measuredShearDeg: number;
      readonly maximumSupportedShearDeg: number;
    }
  | { readonly status: "invalid"; readonly reason: string };

/** Inverts a column-major mat4. Returns null when singular. */
function invertMat4(m: ArrayLike<number>): number[] | null {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!Number.isFinite(det) || det === 0) return null;
  const invDet = 1 / det;

  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * invDet,
    (a02 * b10 - a01 * b11 - a03 * b09) * invDet,
    (a31 * b05 - a32 * b04 + a33 * b03) * invDet,
    (a22 * b04 - a21 * b05 - a23 * b03) * invDet,
    (a12 * b08 - a10 * b11 - a13 * b07) * invDet,
    (a00 * b11 - a02 * b08 + a03 * b07) * invDet,
    (a32 * b02 - a30 * b05 - a33 * b01) * invDet,
    (a20 * b05 - a22 * b02 + a23 * b01) * invDet,
    (a10 * b10 - a11 * b08 + a13 * b06) * invDet,
    (a01 * b08 - a00 * b10 - a03 * b06) * invDet,
    (a30 * b04 - a31 * b02 + a33 * b00) * invDet,
    (a21 * b02 - a20 * b04 - a23 * b00) * invDet,
    (a11 * b07 - a10 * b09 - a12 * b06) * invDet,
    (a00 * b09 - a01 * b07 + a02 * b06) * invDet,
    (a31 * b01 - a30 * b03 - a32 * b00) * invDet,
    (a20 * b03 - a21 * b01 + a22 * b00) * invDet,
  ];
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Builds a sampler over a loaded Niivue volume, refusing sources whose geometry
 * this phase does not safely support.
 *
 * All voxel permutation and intensity rescaling are delegated to Niivue's own
 * getValue, so no ordering or slope/intercept logic is duplicated here. World
 * coordinates travel through the cached inverse of frac2mmOrtho, which is the
 * same orthogonal frame the planning pipeline already uses.
 */
export function createNiivueVolumeSampler(input: NiivueSamplerInput): NiivueSamplerCreationResult {
  const { volumeId, image, geometry } = input;

  // 1. Required geometry and image fields.
  if (typeof volumeId !== "string" || volumeId.length === 0) {
    return { status: "invalid", reason: "volumeId must be a non-empty string" };
  }
  const dims = geometry.dimensionsVox;
  if (!isPositiveInteger(dims.x) || !isPositiveInteger(dims.y) || !isPositiveInteger(dims.z)) {
    return { status: "invalid", reason: "volume dimensions must be positive integers" };
  }
  if (typeof image.getValue !== "function") {
    return { status: "invalid", reason: "image must expose getValue" };
  }
  const affine = image.frac2mmOrtho;
  if (!affine || affine.length < 16) {
    return { status: "invalid", reason: "image must expose a frac2mmOrtho matrix" };
  }
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(affine[i])) {
      return { status: "invalid", reason: "frac2mmOrtho must be finite" };
    }
  }
  const inverse = invertMat4(affine);
  if (!inverse) {
    return { status: "invalid", reason: "frac2mmOrtho must be invertible" };
  }

  // 2. Obliquity and shear must be measurable.
  const { angleDeg, maxShearDeg } = geometry.obliquity;
  if (!Number.isFinite(angleDeg) || !Number.isFinite(maxShearDeg)) {
    return { status: "invalid", reason: "source obliquity measurements must be finite" };
  }

  // 3. Source obliquity gate.
  if (angleDeg > MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG) {
    return {
      status: "unsupported",
      reason: "source-volume-obliquity",
      measuredAngleDeg: angleDeg,
      maximumSupportedAngleDeg: MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG,
    };
  }

  // 4. Source shear gate, independent of obliquity.
  if (maxShearDeg > MAX_SUPPORTED_SOURCE_SHEAR_DEG) {
    return {
      status: "unsupported",
      reason: "source-volume-shear",
      measuredShearDeg: maxShearDeg,
      maximumSupportedShearDeg: MAX_SUPPORTED_SOURCE_SHEAR_DEG,
    };
  }

  // 5. Construct the sampler.
  const dimX = dims.x;
  const dimY = dims.y;
  const dimZ = dims.z;

  const sampler: VolumeSampler = {
    volumeId,
    dimensions: [dimX, dimY, dimZ],

    worldToVoxel(xMm: number, yMm: number, zMm: number, out: MutableVec3): boolean {
      if (!Number.isFinite(xMm) || !Number.isFinite(yMm) || !Number.isFinite(zMm)) return false;

      // Column-major mat4 times [x, y, z, 1]; the affine row keeps w at 1.
      const fracX = inverse[0] * xMm + inverse[4] * yMm + inverse[8] * zMm + inverse[12];
      const fracY = inverse[1] * xMm + inverse[5] * yMm + inverse[9] * zMm + inverse[13];
      const fracZ = inverse[2] * xMm + inverse[6] * yMm + inverse[10] * zMm + inverse[14];

      // Fractional coordinate to continuous RAS voxel; no rounding here.
      out.x = fracX * dimX - 0.5;
      out.y = fracY * dimY - 0.5;
      out.z = fracZ * dimZ - 0.5;
      return true;
    },

    getVoxel(x: number, y: number, z: number): number | null {
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return null;
      if (x < 0 || y < 0 || z < 0 || x >= dimX || y >= dimY || z >= dimZ) return null;
      // getValue owns permutation and slope/intercept; the value is returned verbatim.
      return image.getValue(x, y, z);
    },
  };

  return { status: "ready", sampler };
}
