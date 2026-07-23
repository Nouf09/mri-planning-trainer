import { useEffect, useMemo, useRef, useState } from "react";
import type { Prescription } from "@/features/planning/domain/prescription";
import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import type { PlanningMode } from "@/features/imaging/data/imaging-config";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import { buildObliquePreview } from "@/features/imaging/reslice/runtime/build-oblique-preview";
import type { ObliquePreviewState } from "@/features/imaging/reslice/runtime/oblique-preview.types";
import {
  createPreviewScheduler,
  type Deferrer,
} from "@/features/imaging/reslice/runtime/oblique-preview-scheduler";

export interface UseObliquePreviewInput {
  readonly engineKind: ImagingEngineKind;
  readonly planningMode: PlanningMode;
  readonly prescription: Prescription | null;
  readonly capabilities: ImagingRuntimeCapabilities | null;
  /** Test seam for deterministic scheduling. */
  readonly deferrer?: Deferrer;
}

const HIDDEN: ObliquePreviewState = { status: "hidden" };

/**
 * Drives the oblique preview off-render.
 *
 * The preview only runs for the Niivue world route. Reslicing happens inside a
 * coalesced, generation-guarded scheduler, so rapid prescription changes never
 * publish a stale slice and none runs during React render.
 */
export function useObliquePreview(input: UseObliquePreviewInput): ObliquePreviewState {
  const { engineKind, planningMode, prescription, capabilities, deferrer } = input;
  const [state, setState] = useState<ObliquePreviewState>(HIDDEN);

  const scheduler = useMemo(() => createPreviewScheduler(deferrer), [deferrer]);

  const active = engineKind === "niivue" && planningMode === "world";
  // A capability from a different volume must never drive the current preview.
  const volumeIdentity = capabilities?.volumeIdentity ?? null;

  useEffect(() => {
    if (!active) {
      scheduler.cancel();
      setState(HIDDEN);
      return;
    }
    if (!capabilities) {
      scheduler.cancel();
      setState({ status: "waiting-for-volume" });
      return;
    }

    scheduler.request(
      () => buildObliquePreview({ prescription, capabilities }),
      setState
    );

    return () => scheduler.cancel();
    // volumeIdentity is included so a volume swap re-keys the computation.
  }, [active, capabilities, volumeIdentity, prescription, scheduler]);

  useEffect(() => () => scheduler.cancel(), [scheduler]);

  return state;
}
