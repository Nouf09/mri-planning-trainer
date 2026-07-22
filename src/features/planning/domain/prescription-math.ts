import type { VolumePosition } from "@/features/imaging/domain/volume-position";
import { boundsSize, type WorldBounds } from "@/features/imaging/domain/volume-geometry";
import type { PlaneOrientation } from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import { dot, subtract, type Vec3 } from "@/features/planning/domain/vector";

/** A point in a view plane's own millimetre basis, relative to the view origin. */
export interface Point2Dmm {
  uMm: number;
  vMm: number;
}

/** Four ordered corners in the view plane's millimetre basis. */
export type PlanarQuadMm = readonly [Point2Dmm, Point2Dmm, Point2Dmm, Point2Dmm];

/**
 * A prescription seen from a view plane.
 *
 * Orthographic projection is affine, so the rectangular slice group becomes a
 * parallelogram. Half-axes and the normal step are reported so callers can
 * translate the outline per slice without repeating the projection.
 */
export interface PrescriptionPlanarProjection {
  readonly center: Point2Dmm;
  readonly outline: PlanarQuadMm;
  /** Half the read field of view, projected. */
  readonly halfRead: Point2Dmm;
  /** Half the phase field of view, projected. */
  readonly halfPhase: Point2Dmm;
  /** In-view travel per millimetre along the prescription normal. */
  readonly normalStepMm: Point2Dmm;
  /** |cos| of the angle between the prescription and view normals. */
  readonly alignment: number;
  readonly outOfPlaneOffsetMm: number;
  readonly sliceOffsetsMm: readonly number[];
}

/** Centre-to-centre distance between neighbouring slices. */
export function sliceSpacingMm(prescription: Prescription): number {
  return prescription.sliceThickness + prescription.sliceGap;
}

/** Signed offsets of each slice centre from the prescription centre, along its normal. */
export function sliceOffsetsMm(prescription: Prescription): number[] {
  const { sliceCount } = prescription;
  if (sliceCount <= 0) return [];

  const spacing = sliceSpacingMm(prescription);
  const first = -((sliceCount - 1) / 2) * spacing;
  return Array.from({ length: sliceCount }, (_, index) => first + index * spacing);
}

/** Total slab extent along the prescription normal. */
export function coverageMm(prescription: Prescription): number {
  const { sliceCount, sliceThickness, sliceGap } = prescription;
  if (sliceCount <= 0) return 0;
  return sliceCount * sliceThickness + (sliceCount - 1) * sliceGap;
}

/**
 * Extent of an image source along a view's own axes.
 *
 * Takes bounds rather than a particular descriptor so synthetic and real image
 * sources share one projection path.
 */
export function viewExtentMm(
  bounds: WorldBounds,
  view: PlaneOrientation
): { uMm: number; vMm: number } {
  const size = boundsSize(bounds);
  const along = (axis: Vec3) =>
    Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z;

  return { uMm: along(view.readDirection), vMm: along(view.phaseDirection) };
}

const add2 = (a: Point2Dmm, b: Point2Dmm): Point2Dmm => ({
  uMm: a.uMm + b.uMm,
  vMm: a.vMm + b.vMm,
});
const sub2 = (a: Point2Dmm, b: Point2Dmm): Point2Dmm => ({
  uMm: a.uMm - b.uMm,
  vMm: a.vMm - b.vMm,
});

/** Expresses a world direction in the view plane's millimetre basis. */
function inViewBasis(direction: Vec3, view: PlaneOrientation): Point2Dmm {
  return { uMm: dot(direction, view.readDirection), vMm: dot(direction, view.phaseDirection) };
}

/**
 * Projects a prescription orthographically into a view plane.
 *
 * One formulation serves every relationship between the two planes:
 * foreshortening falls out of the projected half-axes, and a perpendicular
 * view simply collapses one of them toward zero.
 *
 * Corner order is fixed as (-read,-phase), (+read,-phase), (+read,+phase),
 * (-read,+phase) so downstream consumers can rely on it.
 */
export function projectToViewPlane(
  prescription: Prescription,
  view: PlaneOrientation,
  viewOrigin: VolumePosition
): PrescriptionPlanarProjection {
  const p = prescription.orientation;
  const offset = subtract(prescription.center, viewOrigin);

  const center: Point2Dmm = inViewBasis(offset, view);
  const outOfPlaneOffsetMm = dot(offset, view.normal);

  const readAxis = inViewBasis(p.readDirection, view);
  const phaseAxis = inViewBasis(p.phaseDirection, view);

  const halfRead: Point2Dmm = {
    uMm: (readAxis.uMm * prescription.fovRead) / 2,
    vMm: (readAxis.vMm * prescription.fovRead) / 2,
  };
  const halfPhase: Point2Dmm = {
    uMm: (phaseAxis.uMm * prescription.fovPhase) / 2,
    vMm: (phaseAxis.vMm * prescription.fovPhase) / 2,
  };

  const outline: PlanarQuadMm = [
    sub2(sub2(center, halfRead), halfPhase),
    sub2(add2(center, halfRead), halfPhase),
    add2(add2(center, halfRead), halfPhase),
    add2(sub2(center, halfRead), halfPhase),
  ];

  return {
    center,
    outline,
    halfRead,
    halfPhase,
    normalStepMm: inViewBasis(p.normal, view),
    alignment: Math.abs(dot(p.normal, view.normal)),
    outOfPlaneOffsetMm,
    sliceOffsetsMm: sliceOffsetsMm(prescription),
  };
}
