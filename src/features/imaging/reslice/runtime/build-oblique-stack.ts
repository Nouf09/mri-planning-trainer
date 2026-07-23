import type { Prescription } from "@/features/planning/domain/prescription";
import { sliceOffsetsMm } from "@/features/planning/domain/prescription-math";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import { prescriptionToResliceRequest } from "@/features/imaging/reslice/prescription-to-reslice-request";
import { resliceVolume } from "@/features/imaging/reslice/reslice-volume";
import { toGrayscale } from "@/features/imaging/reslice/intensity-mapping";
import { PREVIEW_MESSAGES } from "@/features/imaging/reslice/runtime/oblique-preview.types";
import type { ObliquePreviewImage } from "@/features/imaging/reslice/runtime/oblique-preview.types";
import { previewOutputDimensions } from "@/features/imaging/reslice/runtime/preview-output-dimensions";
import type {
  StackDescriptor,
  StackDescriptorResult,
} from "@/features/imaging/reslice/runtime/oblique-stack.types";

// Phase 10D stack layer. It supersedes the single-slice preview only at the
// Index composition layer; the Phase 10C modules (build-oblique-preview,
// use-oblique-preview, ObliquePreviewViewport) are intentionally preserved
// byte-identical as the validated single-slice reference, and the stack's
// centre slice reproduces their output numerically (see the integration test).

function orientationKey(prescription: Prescription): string {
  const { readDirection: r, phaseDirection: p, normal: n } = prescription.orientation;
  return `${r.x},${r.y},${r.z};${p.x},${p.y},${p.z};${n.x},${n.y},${n.z}`;
}

/** A string capturing every rendering-affecting input, for cache identity. */
function stackIdentity(
  volumeIdentity: string,
  width: number,
  height: number,
  windowMin: number,
  windowMax: number,
  prescription: Prescription,
  offsetsMm: readonly number[]
): string {
  const c = prescription.center;
  return [
    volumeIdentity,
    `${width}x${height}`,
    `${windowMin}:${windowMax}`,
    `c${c.x},${c.y},${c.z}`,
    `o${orientationKey(prescription)}`,
    `n${offsetsMm.length}`,
    offsetsMm.join(","),
  ].join("|");
}

/**
 * Builds a stack descriptor from the current prescription and volume capability.
 *
 * Runs the gate once (via createSampler) and reads slice positions from the
 * planning domain. Returns an unavailable result rather than a descriptor when
 * the source is refused, has no window, or has an unusable field of view.
 */
export function buildStackDescriptor(
  prescription: Prescription,
  capabilities: ImagingRuntimeCapabilities
): StackDescriptorResult {
  const samplerCapability = capabilities.volumeSampler;
  if (!samplerCapability) return { status: "invalid", message: PREVIEW_MESSAGES.invalidWindow };

  const creation = samplerCapability.createSampler();
  if (creation.status === "unsupported") {
    const message =
      creation.reason === "source-volume-shear"
        ? PREVIEW_MESSAGES.unsupportedShear
        : PREVIEW_MESSAGES.unsupportedObliquity;
    return { status: "unsupported", message };
  }
  if (creation.status === "invalid") {
    return { status: "invalid", message: PREVIEW_MESSAGES.invalidVolume };
  }

  const dimensions = previewOutputDimensions(prescription.fovRead, prescription.fovPhase);
  if (!dimensions) return { status: "invalid", message: PREVIEW_MESSAGES.invalidVolume };

  // The sole source of truth for stack positions.
  const offsetsMm = sliceOffsetsMm(prescription);
  if (offsetsMm.length === 0) return { status: "invalid", message: PREVIEW_MESSAGES.invalidVolume };

  const window = samplerCapability.intensityWindow;
  const descriptor: StackDescriptor = {
    identity: stackIdentity(
      samplerCapability.volumeIdentity,
      dimensions.width,
      dimensions.height,
      window.min,
      window.max,
      prescription,
      offsetsMm
    ),
    volumeIdentity: samplerCapability.volumeIdentity,
    sampler: creation.sampler,
    window,
    outputWidth: dimensions.width,
    outputHeight: dimensions.height,
    offsetsMm,
    prescription,
  };
  return { status: "ready", descriptor };
}

export type StackSliceResult =
  | { readonly status: "ready"; readonly image: ObliquePreviewImage }
  | { readonly status: "error"; readonly message: string };

/**
 * Renders one slice of the stack, positioned at its centre offset.
 *
 * Reuses the frozen reslice pipeline unchanged: request mapper -> reslice ->
 * gray-scale mapping. This is the plane at `offsetsMm[index]`; thickness is not
 * integrated.
 */
export function renderStackSlice(descriptor: StackDescriptor, index: number): StackSliceResult {
  if (!Number.isInteger(index) || index < 0 || index >= descriptor.offsetsMm.length) {
    return { status: "error", message: PREVIEW_MESSAGES.resliceFailed };
  }

  const request = prescriptionToResliceRequest(descriptor.prescription, {
    volumeId: descriptor.volumeIdentity,
    outputWidthPx: descriptor.outputWidth,
    outputHeightPx: descriptor.outputHeight,
    sliceOffsetMm: descriptor.offsetsMm[index],
    interpolation: "trilinear",
    outOfBounds: "transparent",
  });

  const outcome = resliceVolume(request, descriptor.sampler);
  if (outcome.status !== "ok") return { status: "error", message: PREVIEW_MESSAGES.resliceFailed };

  const mapped = toGrayscale(outcome.slice, descriptor.window);
  if (mapped.status !== "ok") return { status: "error", message: PREVIEW_MESSAGES.invalidWindow };

  return {
    status: "ready",
    image: {
      width: mapped.image.width,
      height: mapped.image.height,
      gray: mapped.image.gray,
      alpha: mapped.image.alpha,
    },
  };
}

/** The centre index of a stack, matching the acquisition convention. */
export function centreSliceIndex(sliceCount: number): number {
  return Math.floor(sliceCount / 2);
}
