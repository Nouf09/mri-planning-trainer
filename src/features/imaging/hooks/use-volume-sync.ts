import { useEffect, useRef } from "react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { ImagingEngineStatus } from "@/features/imaging/domain/volume.types";
import type { VolumePosition } from "@/features/imaging/domain/volume-position";
import { isVolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";

interface VolumeSyncOptions {
  engine: ImagingEngine;
  status: ImagingEngineStatus;
  position: VolumePosition | null;
  onPositionChange: (position: VolumePosition) => void;
}

/**
 * Binds one viewport's engine to the shared position.
 *
 * Viewports never talk to each other: an engine reports upward, and the shared
 * position flows back down to every engine.
 */
export function useVolumeSync({
  engine,
  status,
  position,
  onPositionChange,
}: VolumeSyncOptions): void {
  // Held in a ref so a re-render never leaves a stale closure registered with
  // the engine.
  const onPositionChangeRef = useRef(onPositionChange);
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    if (!isVolumeImagingEngine(engine)) return;
    engine.setPositionListener((next) => onPositionChangeRef.current(next));
    return () => engine.setPositionListener(null);
  }, [engine]);

  // Seed the shared position from the volume centre once, when the first
  // viewport becomes ready. This is the only publish that is not user-driven.
  useEffect(() => {
    if (status !== "ready" || position !== null) return;
    if (!isVolumeImagingEngine(engine)) return;
    const center = engine.getCenterPosition();
    if (center) onPositionChangeRef.current(center);
  }, [engine, status, position]);

  useEffect(() => {
    if (status !== "ready" || !position) return;
    if (!isVolumeImagingEngine(engine)) return;
    engine.setPosition(position);
  }, [engine, status, position]);
}
