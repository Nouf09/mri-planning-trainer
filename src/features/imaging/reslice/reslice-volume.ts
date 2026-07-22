import {
  validateObliqueSliceRequest,
  type ObliqueSliceRequest,
} from "@/features/imaging/reslice/oblique-slice-request";
import {
  sampleNearest,
  sampleTrilinear,
} from "@/features/imaging/reslice/interpolation";
import type { MutableVec3, VolumeSampler } from "@/features/imaging/reslice/volume-sampler";

/**
 * A sampled plane, in row-major order with `width * height` entries.
 *
 * Intensities are the sampler's own scalar values: nothing is normalized here,
 * so display mapping stays a separate concern. Alpha is 0 for samples that fell
 * outside the volume and 255 otherwise, which keeps "no data" visually distinct
 * from genuine low signal.
 *
 * Buffers are freshly allocated per call and never alias sampler storage.
 */
export interface ReslicedSlice {
  readonly width: number;
  readonly height: number;
  readonly intensities: Float32Array;
  readonly alpha: Uint8Array;
  /** Extremes across sampled pixels only; null when nothing was sampled. */
  readonly minIntensity: number | null;
  readonly maxIntensity: number | null;
}

export type ResliceOutcome =
  | { readonly status: "ok"; readonly slice: ReslicedSlice }
  | { readonly status: "invalid-request"; readonly reason: string }
  | { readonly status: "volume-mismatch"; readonly reason: string };

const OPAQUE = 255;
const TRANSPARENT = 0;

/**
 * Samples an oblique plane from a volume.
 *
 * Pixel centres are sampled, so column c covers the centre of its cell rather
 * than its corner:
 *
 *   uMm = ((column + 0.5) / width  - 0.5) * fovReadMm
 *   vMm = (0.5 - (row + 0.5) / height) * fovPhaseMm
 *
 * Column 0 begins at the negative read edge and row 0 at the positive phase
 * edge, so positive phase points up the output image. The vertical term is
 * inverted here, once, and never again downstream.
 */
export function resliceVolume(
  request: ObliqueSliceRequest,
  sampler: VolumeSampler
): ResliceOutcome {
  const validation = validateObliqueSliceRequest(request);
  if (validation.status === "invalid") {
    return { status: "invalid-request", reason: validation.reason };
  }

  if (request.volumeId !== sampler.volumeId) {
    return {
      status: "volume-mismatch",
      reason: `request targets volume '${request.volumeId}' but sampler holds '${sampler.volumeId}'`,
    };
  }

  const width = request.outputWidthPx;
  const height = request.outputHeightPx;
  const intensities = new Float32Array(width * height);
  const alpha = new Uint8Array(width * height);

  const clamp = request.outOfBounds === "clamp";
  const useTrilinear = request.interpolation === "trilinear";

  const center = request.centerWorldMm;
  const read = request.readDirectionWorld;
  const phase = request.phaseDirectionWorld;
  const normal = request.normalDirectionWorld;
  const offset = request.sliceOffsetMm;

  // The slice offset shifts the whole plane along its normal.
  const baseX = center.x + normal.x * offset;
  const baseY = center.y + normal.y * offset;
  const baseZ = center.z + normal.z * offset;

  // Reused so the innermost loop allocates nothing.
  const voxel: MutableVec3 = { x: 0, y: 0, z: 0 };

  let minIntensity = Number.POSITIVE_INFINITY;
  let maxIntensity = Number.NEGATIVE_INFINITY;
  let sampledAny = false;

  for (let row = 0; row < height; row++) {
    const vMm = (0.5 - (row + 0.5) / height) * request.fovPhaseMm;
    const rowStart = row * width;

    for (let column = 0; column < width; column++) {
      const uMm = ((column + 0.5) / width - 0.5) * request.fovReadMm;

      const worldX = baseX + read.x * uMm + phase.x * vMm;
      const worldY = baseY + read.y * uMm + phase.y * vMm;
      const worldZ = baseZ + read.z * uMm + phase.z * vMm;

      const index = rowStart + column;

      if (!sampler.worldToVoxel(worldX, worldY, worldZ, voxel)) {
        intensities[index] = 0;
        alpha[index] = TRANSPARENT;
        continue;
      }

      const value = useTrilinear
        ? sampleTrilinear(sampler, voxel.x, voxel.y, voxel.z, clamp)
        : sampleNearest(sampler, voxel.x, voxel.y, voxel.z, clamp);

      if (value === null) {
        intensities[index] = 0;
        alpha[index] = TRANSPARENT;
        continue;
      }

      intensities[index] = value;
      alpha[index] = OPAQUE;
      sampledAny = true;
      if (value < minIntensity) minIntensity = value;
      if (value > maxIntensity) maxIntensity = value;
    }
  }

  return {
    status: "ok",
    slice: {
      width,
      height,
      intensities,
      alpha,
      minIntensity: sampledAny ? minIntensity : null,
      maxIntensity: sampledAny ? maxIntensity : null,
    },
  };
}
