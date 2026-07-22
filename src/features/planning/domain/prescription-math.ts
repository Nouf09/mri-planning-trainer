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

export interface SliceLineMm {
  start: Point2Dmm;
  end: Point2Dmm;
}

export interface PrescriptionProjection {
  /** Where the prescription centre falls in this view, in millimetres. */
  center: Point2Dmm;
  /** Extent along the view's read (u) axis. */
  widthMm: number;
  /** Extent along the view's phase (v) axis. */
  heightMm: number;
  /** In-plane rotation of the rectangle within this view. */
  rotationDeg: number;
  /** Slice boundaries as seen here. Empty in the prescription's own plane. */
  sliceLines: SliceLineMm[];
  /** True when the slice group is viewed from the side rather than face on. */
  isEdgeOn: boolean;
  /** Signed distance from the view plane to the prescription centre. */
  outOfPlaneOffsetMm: number;
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

/** Threshold separating a face-on view from an edge-on one. */
const EDGE_ON_ALIGNMENT = 0.5;

/**
 * Describes how a prescription appears inside a given view plane.
 *
 * Position is reported explicitly, so a renderer never has to assume the
 * prescription sits at the centre of the viewport.
 *
 * Slice boundaries are only visible edge-on: standing in the slice plane you
 * see one slice face, not the stack.
 *
 * Oblique relationships between the prescription and the view are classified by
 * the dominant alignment. That is exact for the axis-aligned cases this phase
 * produces; true oblique geometry arrives with 3D angulation.
 */
export function projectToViewPlane(
  prescription: Prescription,
  view: PlaneOrientation,
  viewOrigin: VolumePosition
): PrescriptionProjection {
  const u = view.readDirection;
  const v = view.phaseDirection;
  const offset = subtract(prescription.center, viewOrigin);

  const center: Point2Dmm = { uMm: dot(offset, u), vMm: dot(offset, v) };
  const outOfPlaneOffsetMm = dot(offset, view.normal);

  const p = prescription.orientation;
  const alignment = Math.abs(dot(p.normal, view.normal));
  const isEdgeOn = alignment < EDGE_ON_ALIGNMENT;

  if (!isEdgeOn) {
    // Face on: the slice plane fills the view with its field of view.
    const rotationDeg =
      (Math.atan2(dot(p.readDirection, v), dot(p.readDirection, u)) * 180) / Math.PI;
    return {
      center,
      widthMm: prescription.fovRead,
      heightMm: prescription.fovPhase,
      rotationDeg,
      sliceLines: [],
      isEdgeOn: false,
      outOfPlaneOffsetMm,
    };
  }

  // Edge on: the slab's extent along each view axis is the sum of its three
  // dimensions projected onto that axis.
  const coverage = coverageMm(prescription);
  const extentAlong = (axis: Vec3) =>
    Math.abs(dot(p.readDirection, axis)) * prescription.fovRead +
    Math.abs(dot(p.phaseDirection, axis)) * prescription.fovPhase +
    Math.abs(dot(p.normal, axis)) * coverage;

  const widthMm = extentAlong(u);
  const heightMm = extentAlong(v);

  const normalOnU = dot(p.normal, u);
  const normalOnV = dot(p.normal, v);
  const stacksVertically = Math.abs(normalOnV) >= Math.abs(normalOnU);

  const sliceLines = sliceOffsetsMm(prescription).map((slice) => {
    if (stacksVertically) {
      const vMm = center.vMm + slice * normalOnV;
      return {
        start: { uMm: center.uMm - widthMm / 2, vMm },
        end: { uMm: center.uMm + widthMm / 2, vMm },
      };
    }
    const uMm = center.uMm + slice * normalOnU;
    return {
      start: { uMm, vMm: center.vMm - heightMm / 2 },
      end: { uMm, vMm: center.vMm + heightMm / 2 },
    };
  });

  return {
    center,
    widthMm,
    heightMm,
    rotationDeg: 0,
    sliceLines,
    isEdgeOn: true,
    outOfPlaneOffsetMm,
  };
}
