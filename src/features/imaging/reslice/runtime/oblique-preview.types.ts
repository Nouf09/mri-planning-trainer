/** Gray pixels plus per-pixel alpha, ready for a canvas painter. */
export interface ObliquePreviewImage {
  readonly width: number;
  readonly height: number;
  readonly gray: Uint8ClampedArray;
  readonly alpha: Uint8Array;
}

/**
 * Explicit, mutually exclusive preview states.
 *
 * The UI never infers which is authoritative; every case carries exactly what
 * it needs to render.
 */
export type ObliquePreviewState =
  | { readonly status: "hidden" }
  | { readonly status: "waiting-for-volume" }
  | { readonly status: "unsupported"; readonly message: string }
  | { readonly status: "invalid"; readonly message: string }
  | { readonly status: "ready"; readonly image: ObliquePreviewImage }
  | { readonly status: "error"; readonly message: string };

export const PREVIEW_MESSAGES = {
  waiting: "Load a Niivue volume to generate the planned slice.",
  noPrescription: "No world-space prescription is available.",
  unsupportedObliquity: "Oblique preview is unavailable for this source volume geometry.",
  unsupportedShear: "Oblique preview is unavailable for this source volume geometry.",
  invalidVolume: "The loaded volume cannot be sampled safely.",
  invalidWindow: "The loaded volume has no usable display window.",
  resliceFailed: "The planned slice could not be generated.",
} as const;
