import type { Prescription } from "@/features/planning/domain/prescription";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import { prescriptionToResliceRequest } from "@/features/imaging/reslice/prescription-to-reslice-request";
import { resliceVolume } from "@/features/imaging/reslice/reslice-volume";
import { toGrayscale } from "@/features/imaging/reslice/intensity-mapping";
import {
  PREVIEW_MESSAGES,
  type ObliquePreviewState,
} from "@/features/imaging/reslice/runtime/oblique-preview.types";
import { previewOutputDimensions } from "@/features/imaging/reslice/runtime/preview-output-dimensions";

export interface ObliquePreviewInput {
  readonly prescription: Prescription | null;
  readonly capabilities: ImagingRuntimeCapabilities | null;
}

/**
 * Turns a prescription and a volume capability into a preview state.
 *
 * Pure and synchronous: it runs the whole approved pipeline
 * (gated sampler -> request mapper -> reslice -> intensity mapping) with no
 * scheduling, so the orchestration hook can call it inside a frame and test it
 * directly. Safety gates are honoured; a refusal never yields pixels.
 */
export function buildObliquePreview(input: ObliquePreviewInput): ObliquePreviewState {
  const { prescription, capabilities } = input;

  if (!capabilities) return { status: "waiting-for-volume" };
  if (!prescription) return { status: "invalid", message: PREVIEW_MESSAGES.noPrescription };

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

  const request = prescriptionToResliceRequest(prescription, {
    volumeId: samplerCapability.volumeIdentity,
    outputWidthPx: dimensions.width,
    outputHeightPx: dimensions.height,
    sliceOffsetMm: 0,
    interpolation: "trilinear",
    outOfBounds: "transparent",
  });

  const outcome = resliceVolume(request, creation.sampler);
  if (outcome.status !== "ok") {
    return { status: "error", message: PREVIEW_MESSAGES.resliceFailed };
  }

  const mapped = toGrayscale(outcome.slice, samplerCapability.intensityWindow);
  if (mapped.status !== "ok") {
    return { status: "invalid", message: PREVIEW_MESSAGES.invalidWindow };
  }

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
