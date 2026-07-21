import { useEffect, useRef, useState } from "react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { ImagingEngineStatus, VolumeSource } from "@/features/imaging/domain/volume.types";
import { isVolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";

/**
 * Drives the mount -> load -> ready/error -> dispose lifecycle of a volume
 * engine and exposes it as React state.
 *
 * Returns an idle status for engines that do not render volumes, so callers can
 * use it unconditionally.
 */
export function useVolumeEngine(
  engine: ImagingEngine,
  plane: AnatomicalPlane,
  source: VolumeSource
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<ImagingEngineStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  // Callers must render the canvas before the effect can attach to it, so this
  // is derived from the engine rather than from status.
  const isVolume = isVolumeImagingEngine(engine);

  useEffect(() => {
    if (!isVolumeImagingEngine(engine)) {
      setStatus("idle");
      setError(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        await engine.mount(canvas, plane);
        if (cancelled) return;
        await engine.loadVolume(source);
        if (cancelled) return;
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      engine.dispose();
    };
  }, [engine, plane, source]);

  return { canvasRef, status, error, isVolume };
}
