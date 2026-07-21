import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";

export type ImagingEngineKind = "jpg" | "niivue";

/**
 * Supplies the background image for a viewport plane.
 *
 * Responsibility is limited to image rendering. Planning annotations are drawn
 * by an OverlayRenderer so overlays remain independent of the engine.
 */
export interface ImagingEngine {
  readonly kind: ImagingEngineKind;
  /** Background image URL for a plane, or null when the engine paints its own pixels. */
  getBackgroundSource(plane: AnatomicalPlane): string | null;
  dispose(): void;
}
