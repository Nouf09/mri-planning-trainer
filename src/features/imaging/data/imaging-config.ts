import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";

export const DEFAULT_IMAGING_ENGINE: ImagingEngineKind = "jpg";

/**
 * Resolves the engine for this session.
 *
 * Temporary manual-verification affordance: `?engine=niivue` opts into the
 * volume engine. Anything else keeps the default engine.
 */
export function resolveImagingEngineKind(): ImagingEngineKind {
  if (typeof window === "undefined") return DEFAULT_IMAGING_ENGINE;
  try {
    const requested = new URLSearchParams(window.location.search).get("engine");
    return requested === "niivue" ? "niivue" : DEFAULT_IMAGING_ENGINE;
  } catch {
    return DEFAULT_IMAGING_ENGINE;
  }
}
