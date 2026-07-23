import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import { readVolumeGeometry, type VolumeSpatialSource } from "@/features/imaging/adapters/niivue/read-volume-geometry";
import {
  createNiivueVolumeSampler,
  type NiivueImageLike,
  type NiivueSamplerCreationResult,
} from "@/features/imaging/adapters/niivue/niivue-volume-sampler";

/** Which Niivue field supplied the display window. */
export type IntensityWindowSource = "cal" | "robust" | "global";

export interface IntensityWindow {
  readonly min: number;
  readonly max: number;
  readonly source: IntensityWindowSource;
}

/**
 * The narrow, pure surface a loaded volume offers for reslicing.
 *
 * Everything here is a plain project type: no NVImage, no Niivue. `createSampler`
 * is the only approved entry to the gated Phase 10B sampler.
 */
export interface VolumeSamplerCapability {
  readonly volumeIdentity: string;
  readonly geometry: VolumeGeometry;
  readonly intensityWindow: IntensityWindow;
  createSampler(): NiivueSamplerCreationResult;
}

/** A capability provider, feature-detected rather than added to the generic engine interface. */
export interface VolumeSamplerProvider {
  getVolumeSamplerCapability(): VolumeSamplerCapability | null;
}

export function isVolumeSamplerProvider(
  engine: ImagingEngine
): engine is ImagingEngine & VolumeSamplerProvider {
  return typeof (engine as Partial<VolumeSamplerProvider>).getVolumeSamplerCapability === "function";
}

/**
 * The Niivue image fields this adapter reads to build a capability.
 *
 * The window fields are the only additions beyond what geometry and sampling
 * already require; no unrelated NVImage state is exposed.
 */
export interface NiivueVolumeImageLike extends NiivueImageLike, VolumeSpatialSource {
  cal_min?: number;
  cal_max?: number;
  robust_min?: number;
  robust_max?: number;
  global_min?: number;
  global_max?: number;
}

function validWindow(min: number | undefined, max: number | undefined): boolean {
  return (
    typeof min === "number" &&
    typeof max === "number" &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    max > min
  );
}

/**
 * Chooses a display window from the loaded image, preferring the calibrated
 * range, then the robust range, then the global range.
 *
 * Returns null when none is valid, rather than inventing one: no percentiles,
 * no presets, no silent 0-1 substitution.
 */
export function pickIntensityWindow(image: NiivueVolumeImageLike): IntensityWindow | null {
  const candidates: Array<[IntensityWindowSource, number | undefined, number | undefined]> = [
    ["cal", image.cal_min, image.cal_max],
    ["robust", image.robust_min, image.robust_max],
    ["global", image.global_min, image.global_max],
  ];
  for (const [source, min, max] of candidates) {
    if (validWindow(min, max)) return { min: min as number, max: max as number, source };
  }
  return null;
}

/**
 * Builds a capability over a loaded volume, or null when the source cannot be
 * sampled or has no safe display window.
 */
export function buildVolumeSamplerCapability(
  volumeIdentity: string,
  image: NiivueVolumeImageLike
): VolumeSamplerCapability | null {
  if (typeof volumeIdentity !== "string" || volumeIdentity.length === 0) return null;

  const geometry = readVolumeGeometry(image);
  if (!geometry) return null;

  const intensityWindow = pickIntensityWindow(image);
  if (!intensityWindow) return null;

  return {
    volumeIdentity,
    geometry,
    intensityWindow,
    createSampler: (): NiivueSamplerCreationResult =>
      createNiivueVolumeSampler({ volumeId: volumeIdentity, image, geometry }),
  };
}

/**
 * The runtime capabilities a viewport surfaces upward.
 *
 * One cohesive object rather than a growing list of callbacks. The window lives
 * inside `volumeSampler` because it belongs to the sampling source.
 */
export interface ImagingRuntimeCapabilities {
  readonly volumeIdentity: string;
  readonly geometry: VolumeGeometry;
  readonly volumeSampler: VolumeSamplerCapability | null;
}
