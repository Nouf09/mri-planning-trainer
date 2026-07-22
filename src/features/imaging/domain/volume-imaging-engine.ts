import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { VolumeSource } from "@/features/imaging/domain/volume.types";
import type { VolumePosition } from "@/features/imaging/domain/volume-position";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";

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
  /**
   * Move to a world-space position. Applying a position must never cause the
   * engine to report a position change back to its listener.
   */
  setPosition(position: VolumePosition): void;
  /** Register the listener for user-driven position changes. Null clears it. */
  setPositionListener(listener: ((position: VolumePosition) => void) | null): void;
  /** Current position, or null before a volume is loaded. */
  getPosition(): VolumePosition | null;
  /** Centre of the loaded volume, or null before a volume is loaded. */
  getCenterPosition(): VolumePosition | null;
  /**
   * Step through slices of the given plane. Positive steps advance toward
   * higher voxel indices.
   *
   * This is user-driven navigation, so the resulting move is reported to the
   * position listener like any other interaction.
   */
  stepSlice(plane: AnatomicalPlane, steps: number): void;
  /**
   * Navigate to the point under a screen coordinate.
   *
   * Coordinates are passed through untouched: converting screen space to
   * voxel, fractional or world coordinates is the engine's responsibility,
   * along with device pixel ratio, canvas bounds and tile selection.
   *
   * This is user-driven navigation, so the resulting move is reported to the
   * position listener like any other interaction.
   */
  navigateToScreenPoint(clientX: number, clientY: number): void;
  /**
   * Physical geometry of the loaded volume, or null until it is available.
   *
   * Lets planning work against the real image source instead of an assumed
   * extent, without exposing anything library-specific.
   */
  getVolumeGeometry(): VolumeGeometry | null;
}

export function isVolumeImagingEngine(engine: ImagingEngine): engine is VolumeImagingEngine {
  const candidate = engine as Partial<VolumeImagingEngine>;
  return typeof candidate.mount === "function" && typeof candidate.loadVolume === "function";
}
