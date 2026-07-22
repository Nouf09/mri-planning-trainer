import type { Prescription } from "@/features/planning/domain/prescription";
import { coverageMm, projectToViewPlane } from "@/features/planning/domain/prescription-math";
import { dot } from "@/features/planning/domain/vector";
import {
  EMPTY_PROJECTION,
  freezeProjection,
  type ProjectedSliceLine,
  type ProjectionResult,
} from "@/features/imaging/projection/projection-model";
import {
  planeMmToViewportPx,
  type ViewportCamera,
} from "@/features/imaging/projection/viewport-camera";

/**
 * Second stage of the projection pipeline.
 *
 * The planning domain places a prescription into a plane in millimetres; this
 * turns that into viewport pixels, decides how the slice group meets the
 * camera, and freezes the result so a renderer can only paint it.
 */
export function projectPrescription(
  prescription: Prescription,
  camera: ViewportCamera
): ProjectionResult {
  const planar = projectToViewPlane(prescription, camera.orientation, camera.origin);

  const widthPx = planar.widthMm * camera.pxPerMmU;
  const heightPx = planar.heightMm * camera.pxPerMmV;
  const finite = [widthPx, heightPx, planar.center.uMm, planar.center.vMm].every((value) =>
    Number.isFinite(value)
  );
  if (!finite || widthPx <= 0 || heightPx <= 0) return EMPTY_PROJECTION;

  const center = planeMmToViewportPx(camera, planar.center);
  // Screen y is inverted relative to the plane's v axis, so an in-plane
  // rotation runs the other way on screen. Converted once, here.
  const rotationRad = (-planar.rotationDeg * Math.PI) / 180;

  const sliceLines: ProjectedSliceLine[] = planar.sliceLines.map((line) => ({
    start: planeMmToViewportPx(camera, line.start),
    end: planeMmToViewportPx(camera, line.end),
  }));

  const shape = { center, widthPx, heightPx, rotationRad };

  if (!planar.isEdgeOn) {
    return freezeProjection({
      mode: "face",
      rectangle: shape,
      slab: null,
      sliceLines,
      outOfPlaneOffsetMm: planar.outOfPlaneOffsetMm,
      isVisible: true,
    });
  }

  // Seen from the side, the slab's depth runs along whichever screen axis
  // carries the slice normal.
  const normalOnU = dot(prescription.orientation.normal, camera.orientation.readDirection);
  const normalOnV = dot(prescription.orientation.normal, camera.orientation.phaseDirection);
  const stacksVertically = Math.abs(normalOnV) >= Math.abs(normalOnU);
  const thicknessPx =
    coverageMm(prescription) * (stacksVertically ? camera.pxPerMmV : camera.pxPerMmU);

  return freezeProjection({
    mode: "edge",
    rectangle: null,
    slab: { ...shape, thicknessPx },
    sliceLines,
    outOfPlaneOffsetMm: planar.outOfPlaneOffsetMm,
    isVisible: true,
  });
}
