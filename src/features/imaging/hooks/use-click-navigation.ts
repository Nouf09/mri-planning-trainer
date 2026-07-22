import { useCallback } from "react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { ImagingEngineStatus } from "@/features/imaging/domain/volume.types";
import { isVolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";

interface ClickNavigationOptions {
  engine: ImagingEngine;
  status: ImagingEngineStatus;
}

/**
 * Forwards a click into the imaging engine as volume navigation.
 *
 * The planning overlay owns pointer input and keeps priority: callers invoke
 * this only for clicks that did not land on a planning handle.
 */
export function useClickNavigation({ engine, status }: ClickNavigationOptions) {
  return useCallback(
    (clientX: number, clientY: number) => {
      if (!isVolumeImagingEngine(engine)) return;
      if (status !== "ready") return;
      engine.navigateToScreenPoint(clientX, clientY);
    },
    [engine, status]
  );
}
