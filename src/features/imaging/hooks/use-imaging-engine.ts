import { useMemo } from "react";
import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import { createImagingEngine } from "@/features/imaging/adapters/create-imaging-engine";
import { createPlanningOverlayRenderer } from "@/features/imaging/overlays/planning-overlay-renderer";
import { DEFAULT_IMAGING_ENGINE } from "@/features/imaging/data/imaging-config";

/**
 * Resolves the background engine and the planning overlay renderer.
 *
 * Both instances are memoized so viewports keep a stable identity across
 * renders.
 */
export function useImagingEngine(kind: ImagingEngineKind = DEFAULT_IMAGING_ENGINE) {
  const engine = useMemo(() => createImagingEngine(kind), [kind]);
  const overlay = useMemo(() => createPlanningOverlayRenderer(), []);
  return { engine, overlay };
}
