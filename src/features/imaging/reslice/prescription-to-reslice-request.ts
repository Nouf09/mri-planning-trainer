import type { Prescription } from "@/features/planning/domain/prescription";
import type {
  InterpolationMode,
  ObliqueSliceRequest,
  OutOfBoundsMode,
} from "@/features/imaging/reslice/oblique-slice-request";

export interface ResliceRequestOptions {
  readonly volumeId: string;
  readonly outputWidthPx: number;
  readonly outputHeightPx: number;
  /** Distance along the prescription normal. Defaults to the centre slice. */
  readonly sliceOffsetMm?: number;
  readonly interpolation?: InterpolationMode;
  readonly outOfBounds?: OutOfBoundsMode;
}

export const DEFAULT_INTERPOLATION: InterpolationMode = "trilinear";
export const DEFAULT_OUT_OF_BOUNDS: OutOfBoundsMode = "transparent";

/**
 * Restates a planned prescription as a reslice request.
 *
 * A pure translation: the orientation basis and field of view are copied
 * exactly, with no screen coordinates, no viewport, and no world-to-voxel work.
 * The prescription is left untouched.
 */
export function prescriptionToResliceRequest(
  prescription: Prescription,
  options: ResliceRequestOptions
): ObliqueSliceRequest {
  const { orientation } = prescription;

  return {
    volumeId: options.volumeId,
    centerWorldMm: { ...prescription.center },
    readDirectionWorld: { ...orientation.readDirection },
    phaseDirectionWorld: { ...orientation.phaseDirection },
    normalDirectionWorld: { ...orientation.normal },
    fovReadMm: prescription.fovRead,
    fovPhaseMm: prescription.fovPhase,
    sliceOffsetMm: options.sliceOffsetMm ?? 0,
    outputWidthPx: options.outputWidthPx,
    outputHeightPx: options.outputHeightPx,
    interpolation: options.interpolation ?? DEFAULT_INTERPOLATION,
    outOfBounds: options.outOfBounds ?? DEFAULT_OUT_OF_BOUNDS,
  };
}
