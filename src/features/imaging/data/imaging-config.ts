import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";

export const DEFAULT_IMAGING_ENGINE: ImagingEngineKind = "jpg";

/**
 * Resolves the engine for this session.
 *
 * Temporary manual-verification affordance: `?engine=niivue` opts into the
 * volume engine. Anything else keeps the default engine.
 */
export type PlanningMode = "legacy" | "world";

export const DEFAULT_PLANNING_MODE: PlanningMode = "legacy";

/**
 * Reads the requested planning mode. `?planning=world` opts into world-space
 * planning; anything else keeps the default.
 */
export function resolvePlanningMode(): PlanningMode {
  if (typeof window === "undefined") return DEFAULT_PLANNING_MODE;
  try {
    const requested = new URLSearchParams(window.location.search).get("planning");
    return requested === "world" ? "world" : DEFAULT_PLANNING_MODE;
  } catch {
    return DEFAULT_PLANNING_MODE;
  }
}

/**
 * World planning requires an image source whose physical extent is known.
 *
 * Only the JPG source has a synthetic descriptor; a real volume must report its
 * own geometry, which the adapter cannot yet do. Rather than draw a knowingly
 * mis-scaled prescription over real anatomy, the legacy overlay is used.
 */
export function resolveEffectivePlanningMode(
  requested: PlanningMode,
  engineKind: ImagingEngineKind,
  hasPlanningBounds: boolean
): PlanningMode {
  if (requested !== "world") return DEFAULT_PLANNING_MODE;
  if (!hasPlanningBounds) return DEFAULT_PLANNING_MODE;
  return engineKind === "jpg" || engineKind === "niivue" ? "world" : DEFAULT_PLANNING_MODE;
}

export function resolveImagingEngineKind(): ImagingEngineKind {
  if (typeof window === "undefined") return DEFAULT_IMAGING_ENGINE;
  try {
    const requested = new URLSearchParams(window.location.search).get("engine");
    return requested === "niivue" ? "niivue" : DEFAULT_IMAGING_ENGINE;
  } catch {
    return DEFAULT_IMAGING_ENGINE;
  }
}
