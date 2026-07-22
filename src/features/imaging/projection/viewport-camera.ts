import type { ViewportSize } from "@/features/imaging/domain/viewport.types";
import type { VolumePosition } from "@/features/imaging/domain/volume-position";
import { boundsCenter, type WorldBounds } from "@/features/imaging/domain/volume-geometry";
import type { PlaneOrientation } from "@/features/planning/domain/orientation";
import { viewExtentMm } from "@/features/planning/domain/prescription-math";
import type { Point2Dmm } from "@/features/planning/domain/prescription-math";
import type { ProjectedPoint } from "@/features/imaging/projection/projection-model";

/**
 * Everything needed to turn plane-space millimetres into viewport pixels.
 *
 * The camera is the only thing that knows how a view is framed, so an
 * arbitrary orientation needs a different camera rather than different
 * projection code. It knows nothing of anatomy, protocols, React or Canvas.
 */
export interface ViewportCamera {
  readonly orientation: PlaneOrientation;
  /** World point rendered at the centre of the viewport. */
  readonly origin: VolumePosition;
  readonly pxPerMmU: number;
  readonly pxPerMmV: number;
  readonly viewport: ViewportSize;
}

/**
 * Builds a camera that fits an image source's extent to a viewport.
 *
 * Returns null when the extent or viewport cannot produce a usable scale,
 * rather than emitting infinite or negative pixel sizes.
 */
export function createFittedCamera(
  bounds: WorldBounds,
  orientation: PlaneOrientation,
  viewport: ViewportSize
): ViewportCamera | null {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return null;
  if (viewport.width <= 0 || viewport.height <= 0) return null;

  const extent = viewExtentMm(bounds, orientation);
  if (!Number.isFinite(extent.uMm) || !Number.isFinite(extent.vMm)) return null;
  if (extent.uMm <= 0 || extent.vMm <= 0) return null;

  return Object.freeze({
    orientation,
    origin: Object.freeze(boundsCenter(bounds)),
    pxPerMmU: viewport.width / extent.uMm,
    pxPerMmV: viewport.height / extent.vMm,
    viewport: Object.freeze({ width: viewport.width, height: viewport.height }),
  });
}

/**
 * Maps a point in the camera plane's millimetre basis to viewport pixels.
 *
 * The viewport centre is the camera origin, and screen y grows downward while
 * the plane's v axis grows upward, so the vertical term is inverted here once
 * rather than in every renderer.
 */
export function planeMmToViewportPx(camera: ViewportCamera, point: Point2Dmm): ProjectedPoint {
  return {
    x: camera.viewport.width / 2 + point.uMm * camera.pxPerMmU,
    y: camera.viewport.height / 2 - point.vMm * camera.pxPerMmV,
  };
}
