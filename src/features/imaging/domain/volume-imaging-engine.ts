import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { VolumeSource } from "@/features/imaging/domain/volume.types";

/**
 * An engine that paints its own pixels into a canvas from a loaded volume.
 *
 * Extends ImagingEngine rather than widening it, so image-only engines such as
 * the legacy JPG engine need no volume methods.
 */
export interface VolumeImagingEngine extends ImagingEngine {
  /** Attach to a canvas and fix the displayed plane. Safe to call repeatedly. */
  mount(canvas: HTMLCanvasElement, plane: AnatomicalPlane): Promise<void>;
  /** Load a single volume. Rejects on failure so callers can surface an error. */
  loadVolume(source: VolumeSource): Promise<void>;
}

export function isVolumeImagingEngine(engine: ImagingEngine): engine is VolumeImagingEngine {
  const candidate = engine as Partial<VolumeImagingEngine>;
  return typeof candidate.mount === "function" && typeof candidate.loadVolume === "function";
}
