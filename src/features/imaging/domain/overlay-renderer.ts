import type {
  AnatomicalPlane,
  Point2D,
  PlanningHandle,
  ViewportSize,
} from "@/features/imaging/domain/viewport.types";
import type { PlanningGeometry } from "@/features/imaging/domain/overlay.types";

/**
 * Draws annotations above whatever an ImagingEngine renders, and hit-tests them.
 *
 * Kept separate from ImagingEngine so future overlays (crosshair, prescription
 * box, slice stack, orientation labels, reference lines) plug into this layer
 * rather than being embedded in the engine.
 */
export interface OverlayRenderer {
  /** Clears the context and draws the overlay for this plane. */
  render(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportSize,
    plane: AnatomicalPlane,
    geometry: PlanningGeometry
  ): void;
  /** Hit-tests the overlay for drag interaction. */
  hitTest(
    point: Point2D,
    viewport: ViewportSize,
    plane: AnatomicalPlane,
    geometry: PlanningGeometry
  ): PlanningHandle;
}
