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

/** Between axis letters in a code. */
export const AXIS_SEPARATOR = "-";
/** Between axis words in a description. */
const DESCRIPTION_SEPARATOR = ", then ";

interface LetterEntry {
  readonly word: string;
  readonly opposite: string;
}

/**
 * Each letter's word and its opposed letter, derived from AXES above so the
 * opposed pairs are never stated twice. An axis already carries both of its
 * ends, so R/L, A/P and S/I need no second declaration.
 */
const BY_LETTER: ReadonlyMap<string, LetterEntry> = new Map(
  AXES.flatMap((axis): Array<[string, LetterEntry]> => [
    [axis.toward.code, { word: axis.toward.word, opposite: axis.away.code }],
    [axis.away.code, { word: axis.away.word, opposite: axis.toward.code }],
  ])
);

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
    code: parts.map((part) => part.code).join(AXIS_SEPARATOR),
    description: parts.map((part) => part.word).join(DESCRIPTION_SEPARATOR),
  };
}

/**
 * The same axes read the other way along each one.
 *
 * Every letter becomes the opposite end of its own axis, in place, so a
 * compound direction keeps its component order: R-S-P reads as L-I-A, never as
 * P-S-R. Returns null for a code this module did not produce, rather than
 * passing an unknown letter through as though it were anatomical.
 */
export function oppositeDirection(direction: AnatomicalDirection): AnatomicalDirection | null {
  const codes: string[] = [];
  const words: string[] = [];

  for (const letter of direction.code.split(AXIS_SEPARATOR)) {
    const entry = BY_LETTER.get(letter);
    if (!entry) return null;
    const opposite = BY_LETTER.get(entry.opposite);
    if (!opposite) return null;
    codes.push(entry.opposite);
    words.push(opposite.word);
  }

  return {
    code: codes.join(AXIS_SEPARATOR),
    description: words.join(DESCRIPTION_SEPARATOR),
  };
}

/**
 * Where a slice sits relative to the prescription centre.
 *
 * Distinct from the direction of increasing offset: that describes the
 * prescription, while this describes one selected slice. A slice exactly at the
 * centre has a position but no direction, so it is its own case rather than an
 * axis reading.
 */
export type AnatomicalPosition =
  | { readonly kind: "centre" }
  | { readonly kind: "offset"; readonly code: string; readonly description: string };

const CENTRE: AnatomicalPosition = Object.freeze({ kind: "centre" as const });

/**
 * Reads a signed offset along a direction as an anatomical position.
 *
 * The slice centre is `prescriptionCentre + normal * offsetMm`, so a negative
 * offset is a displacement along the opposite of the normal: the same axes read
 * the other way, in the same order. A zero offset is the centre itself, which
 * also settles negative zero without a case of its own, since -0 === 0 and
 * -0 > 0 is false.
 *
 * Returns null when no position can be named: a non-finite offset, or an offset
 * away from the centre along a direction that names no axis.
 */
export function positionForOffset(
  direction: AnatomicalDirection | null,
  offsetMm: number
): AnatomicalPosition | null {
  if (!Number.isFinite(offsetMm)) return null;
  if (offsetMm === 0) return CENTRE;
  if (!direction) return null;

  const reading = offsetMm > 0 ? direction : oppositeDirection(direction);
  if (!reading) return null;

  return { kind: "offset", code: reading.code, description: reading.description };
}
