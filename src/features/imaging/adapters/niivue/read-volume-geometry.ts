import {
  boundsCenter,
  normalizeBounds,
  type VolumeGeometry,
} from "@/features/imaging/domain/volume-geometry";

/**
 * The spatial fields this adapter reads from a loaded volume.
 *
 * Declared structurally so the extraction stays pure and testable, and so no
 * library type escapes the adapter folder.
 *
 * Dimension and spacing arrays follow the NIfTI convention where index 0 is the
 * dimensionality and indices 1..3 are the x, y and z values.
 */
export interface VolumeSpatialSource {
  dimsRAS?: number[];
  pixDimsRAS?: number[];
  /** Bounds of the orthogonal millimetre space, which is the planning space. */
  extentsMinOrtho?: number[];
  extentsMaxOrtho?: number[];
  oblique_angle?: number;
  maxShearDeg?: number;
}

function triple(values: number[] | undefined): { x: number; y: number; z: number } | null {
  if (!values || values.length < 4) return null;
  const [x, y, z] = [values[1], values[2], values[3]];
  if (![x, y, z].every((value) => Number.isFinite(value))) return null;
  return { x, y, z };
}

function point(values: number[] | undefined) {
  if (!values || values.length < 3) return null;
  const [x, y, z] = values;
  if (![x, y, z].every((value) => Number.isFinite(value))) return null;
  return { x, y, z };
}

/**
 * Reads the physical geometry of a loaded volume.
 *
 * Returns null whenever the source has not produced complete spatial metadata,
 * so callers can distinguish "not ready" from "ready with wrong numbers".
 */
export function readVolumeGeometry(source: VolumeSpatialSource | null | undefined): VolumeGeometry | null {
  if (!source) return null;

  const dimensionsVox = triple(source.dimsRAS);
  const spacingMm = triple(source.pixDimsRAS);
  const minCorner = point(source.extentsMinOrtho);
  const maxCorner = point(source.extentsMaxOrtho);
  if (!dimensionsVox || !spacingMm || !minCorner || !maxCorner) return null;

  // Axis directions may run either way; bounds are ordered rather than assumed.
  const bounds = normalizeBounds(minCorner, maxCorner);

  return {
    dimensionsVox,
    spacingMm: { x: Math.abs(spacingMm.x), y: Math.abs(spacingMm.y), z: Math.abs(spacingMm.z) },
    bounds,
    center: boundsCenter(bounds),
    obliquity: {
      angleDeg: Number.isFinite(source.oblique_angle) ? (source.oblique_angle as number) : 0,
      maxShearDeg: Number.isFinite(source.maxShearDeg) ? (source.maxShearDeg as number) : 0,
    },
    coordinateSystem: "niivue-ortho-mm",
  };
}
