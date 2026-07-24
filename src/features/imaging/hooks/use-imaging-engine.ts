import { useMemo } from "react";
import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import { createImagingEngine } from "@/features/imaging/adapters/create-imaging-engine";
import { createPlanningOverlayRenderer } from "@/features/imaging/overlays/planning-overlay-renderer";

/**
 * Builds the background engine and the planning overlay renderer for the
 * injected engine kind, which is resolved once at the composition root and
 * passed down explicitly.
 *
 * Both instances are memoized so viewports keep a stable identity across
 * renders.
 */
export function useImagingEngine(kind: ImagingEngineKind) {
  const engine = useMemo(() => createImagingEngine(kind), [kind]);
  const overlay = useMemo(() => createPlanningOverlayRenderer(), []);
  return { engine, overlay };
}
