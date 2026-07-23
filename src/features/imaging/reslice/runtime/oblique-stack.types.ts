import type { Prescription } from "@/features/planning/domain/prescription";
import type { VolumeSampler } from "@/features/imaging/reslice/volume-sampler";
import type { IntensityWindow } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import type { ObliquePreviewImage } from "@/features/imaging/reslice/runtime/oblique-preview.types";

/**
 * Everything needed to render any slice of one acquisition stack.
 *
 * Built once when a rendering-affecting input changes. Its `identity` string
 * captures every such input, so a per-slice cache tied to it is discarded
 * exactly when it must be. Slice positions come straight from planning
 * (`offsetsMm`), never recomputed here.
 */
export interface StackDescriptor {
  readonly identity: string;
  readonly volumeIdentity: string;
  readonly sampler: VolumeSampler;
  readonly window: IntensityWindow;
  readonly outputWidth: number;
  readonly outputHeight: number;
  /** Signed centre-to-centre offsets along the prescription normal, in order. */
  readonly offsetsMm: readonly number[];
  readonly prescription: Prescription;
}

export type StackDescriptorResult =
  | { readonly status: "ready"; readonly descriptor: StackDescriptor }
  | { readonly status: "unsupported"; readonly message: string }
  | { readonly status: "invalid"; readonly message: string };

/**
 * The stack preview's UI state.
 *
 * Each ready image is the plane at a slice's centre offset. Thickness and gap
 * only set the spacing between offsets; no slab averaging is implied.
 */
export type ObliqueStackState =
  | { readonly status: "hidden" }
  | { readonly status: "waiting-for-volume" }
  | { readonly status: "unsupported"; readonly message: string }
  | { readonly status: "invalid"; readonly message: string }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly sliceCount: number;
      readonly selectedIndex: number;
      readonly image: ObliquePreviewImage;
      /** True when served from cache rather than freshly resliced. Test aid. */
      readonly fromCache: boolean;
    };
