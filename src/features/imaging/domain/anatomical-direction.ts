/**
 * Anatomical reading of a direction in the engine's orthogonal millimetre
 * space.
 *
 * That space is RAS-ordered and axis-aligned: +x runs toward the patient's
 * right, +y anterior, +z superior. The contract is stated on VolumeGeometry,
 * and the source-obliquity gate in the Niivue sampler bounds how far the frame
 * may diverge from true scanner RAS.
 *
 * Letters follow the RAS pairs used by nibabel's orientation utilities (L/R,
 * P/A, I/S). Reducing a vector to letters ordered by decreasing magnitude, with
 * a small epsilon below which a component is ignored, follows the same approach
 * as Cornerstone3D's orientation strings. Those letters are LPS, so the sign of
 * every axis there is opposite to this module: the mapping below is written for
 * RAS and must not be transcribed from an LPS source.
 *
 * Assumptions and their expiry conditions are recorded in
 * docs/mri-sources/slice-orientation.md.
 */

/** A direction in world millimetres. Expected to be unit length. */
export interface DirectionVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AnatomicalDirection {
  /** Axis letters, strongest first, e.g. "S" or "S-R". */
  readonly code: string;
  /** The same axes as words, e.g. "Superior, then Right". */
  readonly description: string;
}

/**
 * Below this magnitude a component is treated as absent rather than as a
 * direction, which keeps rounding noise out of the label.
 */
export const NEGLIGIBLE_COMPONENT = 1e-4;

const AXES = [
  { toward: { code: "R", word: "Right" }, away: { code: "L", word: "Left" } },
  { toward: { code: "A", word: "Anterior" }, away: { code: "P", word: "Posterior" } },
  { toward: { code: "S", word: "Superior" }, away: { code: "I", word: "Inferior" } },
] as const;

/**
 * Names the anatomical axes a direction travels along, strongest first.
 *
 * A direction along one axis reads as a single letter; an oblique direction
 * lists every axis it moves along, so a plane whose normal is dominated by an
 * axis other than the expected one cannot be mistaken for a pure one. Equal
 * components keep a stable x, y, z order rather than picking arbitrarily.
 *
 * Returns null when there is no direction to name: a zero-length or non-finite
 * vector, rather than an invented axis.
 */
export function directionFromNormal(normal: DirectionVector): AnatomicalDirection | null {
  const { x, y, z } = normal;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  const ranked = [x, y, z]
    .map((component, axis) => ({ component, magnitude: Math.abs(component), axis }))
    .filter((entry) => entry.magnitude > NEGLIGIBLE_COMPONENT)
    // Stable sort, so equally strong components keep their axis order.
    .sort((a, b) => b.magnitude - a.magnitude);

  if (ranked.length === 0) return null;

  const parts = ranked.map((entry) =>
    entry.component > 0 ? AXES[entry.axis].toward : AXES[entry.axis].away
  );

  return {
    code: parts.map((part) => part.code).join("-"),
    description: parts.map((part) => part.word).join(", then "),
  };
}
