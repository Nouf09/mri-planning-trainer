import { useEffect, useState } from "react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { ImagingEngineStatus } from "@/features/imaging/domain/volume.types";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import { isVolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";

/**
 * Reads the loaded volume's physical geometry once it is available.
 *
 * Geometry is only meaningful while a volume is ready, so it is cleared for
 * every other state. Kept separate from the engine lifecycle hook so that
 * lifecycle stays untouched.
 */
export function useVolumeGeometry(
  engine: ImagingEngine,
  status: ImagingEngineStatus
): VolumeGeometry | null {
  const [geometry, setGeometry] = useState<VolumeGeometry | null>(null);

  useEffect(() => {
    if (status !== "ready" || !isVolumeImagingEngine(engine)) {
      setGeometry(null);
      return;
    }

    setGeometry(engine.getVolumeGeometry());
    return () => setGeometry(null);
  }, [engine, status]);

  return geometry;
}
