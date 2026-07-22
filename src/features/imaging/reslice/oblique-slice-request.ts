import type { Vec3 } from "@/features/planning/domain/vector";

export type InterpolationMode = "nearest" | "trilinear";
export type OutOfBoundsMode = "transparent" | "clamp";

/**
 * A single oblique plane to sample from a volume.
 *
 * Plain and serializable so it can later serve as a cache key, and free of any
 * imaging-library, framework or canvas type.
 */
export interface ObliqueSliceRequest {
  readonly volumeId: string;

  readonly centerWorldMm: Vec3;
  readonly readDirectionWorld: Vec3;
  readonly phaseDirectionWorld: Vec3;
  readonly normalDirectionWorld: Vec3;

  readonly fovReadMm: number;
  readonly fovPhaseMm: number;
  readonly sliceOffsetMm: number;

  readonly outputWidthPx: number;
  readonly outputHeightPx: number;

  readonly interpolation: InterpolationMode;
  readonly outOfBounds: OutOfBoundsMode;
}

/** Tolerance for basis unit length, orthogonality and handedness. */
export const BASIS_TOLERANCE = 1e-6;

export type RequestValidation =
  | { readonly status: "valid" }
  | { readonly status: "invalid"; readonly reason: string };

const isFiniteNumber = (value: number) => typeof value === "number" && Number.isFinite(value);

const isFiniteVec = (v: Vec3 | undefined | null) =>
  Boolean(v) && isFiniteNumber(v!.x) && isFiniteNumber(v!.y) && isFiniteNumber(v!.z);

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v: Vec3) => Math.sqrt(dot(v, v));
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/**
 * Checks a request before any sampling happens.
 *
 * An invalid basis is reported rather than repaired: silently normalizing a
 * malformed orientation would produce a plane that looks reasonable but is not
 * the one that was planned.
 */
export function validateObliqueSliceRequest(
  request: ObliqueSliceRequest,
  tolerance: number = BASIS_TOLERANCE
): RequestValidation {
  const fail = (reason: string): RequestValidation => ({ status: "invalid", reason });

  if (typeof request.volumeId !== "string" || request.volumeId.length === 0) {
    return fail("volumeId must be a non-empty string");
  }

  if (!Number.isInteger(request.outputWidthPx) || request.outputWidthPx <= 0) {
    return fail("outputWidthPx must be a positive integer");
  }
  if (!Number.isInteger(request.outputHeightPx) || request.outputHeightPx <= 0) {
    return fail("outputHeightPx must be a positive integer");
  }

  if (!isFiniteNumber(request.fovReadMm) || request.fovReadMm <= 0) {
    return fail("fovReadMm must be a positive finite number");
  }
  if (!isFiniteNumber(request.fovPhaseMm) || request.fovPhaseMm <= 0) {
    return fail("fovPhaseMm must be a positive finite number");
  }
  if (!isFiniteNumber(request.sliceOffsetMm)) {
    return fail("sliceOffsetMm must be finite");
  }

  if (!isFiniteVec(request.centerWorldMm)) return fail("centerWorldMm must be finite");

  const read = request.readDirectionWorld;
  const phase = request.phaseDirectionWorld;
  const normal = request.normalDirectionWorld;
  if (!isFiniteVec(read)) return fail("readDirectionWorld must be finite");
  if (!isFiniteVec(phase)) return fail("phaseDirectionWorld must be finite");
  if (!isFiniteVec(normal)) return fail("normalDirectionWorld must be finite");

  const named: Array<[string, Vec3]> = [
    ["readDirectionWorld", read],
    ["phaseDirectionWorld", phase],
    ["normalDirectionWorld", normal],
  ];
  for (const [name, axis] of named) {
    const magnitude = length(axis);
    if (magnitude <= tolerance) return fail(`${name} must not be zero length`);
    if (Math.abs(magnitude - 1) > tolerance) return fail(`${name} must be unit length`);
  }

  if (Math.abs(dot(read, phase)) > tolerance) {
    return fail("readDirectionWorld and phaseDirectionWorld must be orthogonal");
  }
  if (Math.abs(dot(read, normal)) > tolerance) {
    return fail("readDirectionWorld and normalDirectionWorld must be orthogonal");
  }
  if (Math.abs(dot(phase, normal)) > tolerance) {
    return fail("phaseDirectionWorld and normalDirectionWorld must be orthogonal");
  }

  const expected = cross(read, phase);
  if (
    Math.abs(expected.x - normal.x) > tolerance ||
    Math.abs(expected.y - normal.y) > tolerance ||
    Math.abs(expected.z - normal.z) > tolerance
  ) {
    return fail("basis must be right-handed: normal must equal read x phase");
  }

  if (request.interpolation !== "nearest" && request.interpolation !== "trilinear") {
    return fail("interpolation must be 'nearest' or 'trilinear'");
  }
  if (request.outOfBounds !== "transparent" && request.outOfBounds !== "clamp") {
    return fail("outOfBounds must be 'transparent' or 'clamp'");
  }

  return { status: "valid" };
}
