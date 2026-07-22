import {
  AXIAL,
  isOrthonormalOrientation,
  orthonormalize,
  type PlaneOrientation,
} from "@/features/planning/domain/orientation";
import { rotateAroundAxis } from "@/features/planning/domain/vector";

/**
 * The deterministic scalar inputs that define a prescription's orientation.
 *
 * Angles rather than a stored basis: scalars are serializable, resettable, and
 * cannot accumulate drift the way a repeatedly-mutated matrix would.
 */
export interface PrescriptionOrientationInput {
  /** Tilt about the prescription's read axis, in degrees. */
  readonly tiltReadDeg: number;
  /** Tilt about the prescription's phase axis, in degrees. */
  readonly tiltPhaseDeg: number;
  /** Rotation within the slice plane, about its normal, in degrees. */
  readonly inPlaneDeg: number;
}

/** Angles are limited to a range where the composition stays well conditioned. */
export const MAX_ORIENTATION_ANGLE_DEG = 45;

export const NEUTRAL_ORIENTATION_INPUT: PrescriptionOrientationInput = Object.freeze({
  tiltReadDeg: 0,
  tiltPhaseDeg: 0,
  inPlaneDeg: 0,
});

function clampAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_ORIENTATION_ANGLE_DEG, Math.min(MAX_ORIENTATION_ANGLE_DEG, value));
}

export function clampOrientationInput(
  input: PrescriptionOrientationInput
): PrescriptionOrientationInput {
  return {
    tiltReadDeg: clampAngle(input.tiltReadDeg),
    tiltPhaseDeg: clampAngle(input.tiltPhaseDeg),
    inPlaneDeg: clampAngle(input.inPlaneDeg),
  };
}

/**
 * Builds a prescription basis from its orientation angles.
 *
 * Rotations are applied about the prescription's own axes, in a fixed order,
 * each following the right-hand rule about the stated axis:
 *
 *   1. tiltReadDeg   about the read axis      (read fixed; phase and normal turn)
 *   2. tiltPhaseDeg  about the new phase axis (phase fixed; read and normal turn)
 *   3. inPlaneDeg    about the new normal     (normal fixed; read and phase turn)
 *
 * The basis is orthonormalized once at the end, and rejected outright if the
 * result is not a right-handed orthonormal frame.
 */
export function orientationFromAngles(
  input: PrescriptionOrientationInput
): PlaneOrientation | null {
  const { tiltReadDeg, tiltPhaseDeg, inPlaneDeg } = clampOrientationInput(input);

  let read = AXIAL.readDirection;
  let phase = AXIAL.phaseDirection;
  let normal = AXIAL.normal;

  const turnedPhase = rotateAroundAxis(phase, read, tiltReadDeg);
  const turnedNormalA = rotateAroundAxis(normal, read, tiltReadDeg);
  if (!turnedPhase || !turnedNormalA) return null;
  phase = turnedPhase;
  normal = turnedNormalA;

  const turnedRead = rotateAroundAxis(read, phase, tiltPhaseDeg);
  const turnedNormalB = rotateAroundAxis(normal, phase, tiltPhaseDeg);
  if (!turnedRead || !turnedNormalB) return null;
  read = turnedRead;
  normal = turnedNormalB;

  const spunRead = rotateAroundAxis(read, normal, inPlaneDeg);
  const spunPhase = rotateAroundAxis(phase, normal, inPlaneDeg);
  if (!spunRead || !spunPhase) return null;

  const orientation = orthonormalize(spunRead, spunPhase);
  if (!orientation) return null;
  return isOrthonormalOrientation(orientation, 1e-9) ? orientation : null;
}
