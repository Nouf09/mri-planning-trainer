import type { Prescription } from "@/features/planning/domain/prescription";
import {
  projectToViewPlane,
  type Point2Dmm,
} from "@/features/planning/domain/prescription-math";
import {
  EMPTY_PROJECTION,
  classifyProjectionMode,
  freezeProjection,
  type ProjectionResult,
} from "@/features/imaging/projection/projection-model";
import { isFiniteQuad, type ProjectedQuad } from "@/features/imaging/projection/quad";
import {
  planeMmToViewportPx,
  type ViewportCamera,
} from "@/features/imaging/projection/viewport-camera";

/**
 * Second stage of the projection pipeline.
 *
 * The planning domain places a prescription into a view plane in millimetres;
 * this turns that into viewport pixels and freezes the result so a renderer can
 * only paint it. No mode-specific geometry: one projection serves face,
 * oblique and edge-on alike.
 */
export function projectPrescription(
  prescription: Prescription,
  camera: ViewportCamera
): ProjectionResult {
  if (prescription.fovRead <= 0 || prescription.fovPhase <= 0) return EMPTY_PROJECTION;

  const planar = projectToViewPlane(prescription, camera.orientation, camera.origin);

  const translate = (point: Point2Dmm, offsetMm: number): Point2Dmm => ({
    uMm: point.uMm + offsetMm * planar.normalStepMm.uMm,
    vMm: point.vMm + offsetMm * planar.normalStepMm.vMm,
  });

  const toQuad = (offsetMm: number): ProjectedQuad =>
    [
      planeMmToViewportPx(camera, translate(planar.outline[0], offsetMm)),
      planeMmToViewportPx(camera, translate(planar.outline[1], offsetMm)),
      planeMmToViewportPx(camera, translate(planar.outline[2], offsetMm)),
      planeMmToViewportPx(camera, translate(planar.outline[3], offsetMm)),
    ] as const;

  const outline = toQuad(0);
  if (!isFiniteQuad(outline)) return EMPTY_PROJECTION;

  const sliceOutlines = planar.sliceOffsetsMm
    .map((offsetMm) => toQuad(offsetMm))
    .filter(isFiniteQuad);

  // A direction, so it carries the screen's inverted vertical axis but not the
  // viewport centre offset.
  const normalStepPx = {
    x: planar.normalStepMm.uMm * camera.pxPerMmU,
    y: -planar.normalStepMm.vMm * camera.pxPerMmV,
  };
  if (!Number.isFinite(normalStepPx.x) || !Number.isFinite(normalStepPx.y)) {
    return EMPTY_PROJECTION;
  }

  return freezeProjection({
    mode: classifyProjectionMode(planar.alignment),
    outline,
    sliceOutlines,
    normalStepPx,
    outOfPlaneOffsetMm: planar.outOfPlaneOffsetMm,
    isVisible: true,
  });
}
