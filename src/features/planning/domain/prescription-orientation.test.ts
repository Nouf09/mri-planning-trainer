import { describe, it, expect } from "vitest";
import { AXIAL, isOrthonormalOrientation } from "@/features/planning/domain/orientation";
import { areVectorsEqual, cross, dot } from "@/features/planning/domain/vector";
import {
  MAX_ORIENTATION_ANGLE_DEG,
  NEUTRAL_ORIENTATION_INPUT,
  clampOrientationInput,
  orientationFromAngles,
  type PrescriptionOrientationInput,
} from "@/features/planning/domain/prescription-orientation";

const TOL = 1e-9;
const COS45 = Math.cos(Math.PI / 4);

function angles(overrides: Partial<PrescriptionOrientationInput> = {}): PrescriptionOrientationInput {
  return { ...NEUTRAL_ORIENTATION_INPUT, ...overrides };
}

/**
 * Convention under test: each angle is a right-hand-rule rotation about the
 * prescription's own axis, applied in the order read, then phase, then normal.
 */
describe("orientationFromAngles identity", () => {
  it("reproduces AXIAL exactly at zero angles", () => {
    const orientation = orientationFromAngles(NEUTRAL_ORIENTATION_INPUT)!;
    expect(areVectorsEqual(orientation.readDirection, AXIAL.readDirection, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.phaseDirection, AXIAL.phaseDirection, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.normal, AXIAL.normal, TOL)).toBe(true);
  });

  it("is deterministic across repeated evaluation", () => {
    const input = angles({ tiltReadDeg: 17, tiltPhaseDeg: -9, inPlaneDeg: 22 });
    expect(orientationFromAngles(input)).toEqual(orientationFromAngles(input));
  });
});

describe("orientationFromAngles single-axis rotations", () => {
  it("tilts about the read axis, leaving read fixed", () => {
    const orientation = orientationFromAngles(angles({ tiltReadDeg: 45 }))!;
    // Right-hand rule about +x swings +y (phase) toward +z, and +z (normal) toward -y.
    expect(areVectorsEqual(orientation.readDirection, { x: 1, y: 0, z: 0 }, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.phaseDirection, { x: 0, y: COS45, z: COS45 }, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.normal, { x: 0, y: -COS45, z: COS45 }, TOL)).toBe(true);
  });

  it("tilts about the phase axis, leaving phase fixed", () => {
    const orientation = orientationFromAngles(angles({ tiltPhaseDeg: 45 }))!;
    // Right-hand rule about +y swings +z (normal) toward +x, and +x (read) toward -z.
    expect(areVectorsEqual(orientation.phaseDirection, { x: 0, y: 1, z: 0 }, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.readDirection, { x: COS45, y: 0, z: -COS45 }, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.normal, { x: COS45, y: 0, z: COS45 }, TOL)).toBe(true);
  });

  it("rotates in plane about the normal, leaving the normal fixed", () => {
    const orientation = orientationFromAngles(angles({ inPlaneDeg: 45 }))!;
    expect(areVectorsEqual(orientation.normal, AXIAL.normal, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.readDirection, { x: COS45, y: COS45, z: 0 }, TOL)).toBe(true);
    expect(areVectorsEqual(orientation.phaseDirection, { x: -COS45, y: COS45, z: 0 }, TOL)).toBe(true);
  });

  it("clamps a request beyond the supported range to the limit", () => {
    // 90 degrees is outside the supported range, so it becomes a 45 degree tilt.
    expect(orientationFromAngles(angles({ tiltReadDeg: 90 }))).toEqual(
      orientationFromAngles(angles({ tiltReadDeg: MAX_ORIENTATION_ANGLE_DEG }))
    );
  });

  it("reverses direction for a negative angle", () => {
    const positive = orientationFromAngles(angles({ inPlaneDeg: 30 }))!;
    const negative = orientationFromAngles(angles({ inPlaneDeg: -30 }))!;
    expect(positive.readDirection.y).toBeGreaterThan(0);
    expect(negative.readDirection.y).toBeLessThan(0);
  });
});

describe("orientationFromAngles composition order", () => {
  it("applies read tilt before phase tilt", () => {
    const readFirst = orientationFromAngles(angles({ tiltReadDeg: 40, tiltPhaseDeg: 30 }))!;
    const phaseOnly = orientationFromAngles(angles({ tiltPhaseDeg: 30 }))!;
    // Order matters, so the compound result differs from either single rotation.
    expect(areVectorsEqual(readFirst.normal, phaseOnly.normal, 1e-6)).toBe(false);
  });

  it("tilts the normal away from the axial normal", () => {
    const orientation = orientationFromAngles(angles({ tiltReadDeg: 30 }))!;
    const alignment = Math.abs(dot(orientation.normal, AXIAL.normal));
    expect(alignment).toBeCloseTo(Math.cos((30 * Math.PI) / 180), 9);
  });

  it("leaves the normal untouched by in-plane rotation alone", () => {
    const orientation = orientationFromAngles(angles({ inPlaneDeg: 45 }))!;
    expect(Math.abs(dot(orientation.normal, AXIAL.normal))).toBeCloseTo(1, 9);
  });
});

describe("orientationFromAngles invariants", () => {
  const samples = [-45, -31, -1, 0, 1, 17, 45];

  it("stays orthonormal and right-handed across the supported range", () => {
    for (const tiltReadDeg of samples) {
      for (const tiltPhaseDeg of samples) {
        const orientation = orientationFromAngles(
          angles({ tiltReadDeg, tiltPhaseDeg, inPlaneDeg: 23 })
        );
        expect(orientation).not.toBeNull();
        expect(isOrthonormalOrientation(orientation!, 1e-9)).toBe(true);
        const handed = cross(orientation!.readDirection, orientation!.phaseDirection);
        expect(areVectorsEqual(handed, orientation!.normal, 1e-9)).toBe(true);
      }
    }
  });

  it("produces only finite components", () => {
    for (const angle of samples) {
      const orientation = orientationFromAngles(
        angles({ tiltReadDeg: angle, tiltPhaseDeg: angle, inPlaneDeg: angle })
      )!;
      for (const axis of [orientation.readDirection, orientation.phaseDirection, orientation.normal]) {
        expect(Number.isFinite(axis.x) && Number.isFinite(axis.y) && Number.isFinite(axis.z)).toBe(true);
      }
    }
  });

  it("never degenerates within the supported range", () => {
    const orientation = orientationFromAngles(
      angles({ tiltReadDeg: 45, tiltPhaseDeg: 45, inPlaneDeg: 45 })
    )!;
    expect(isOrthonormalOrientation(orientation, 1e-9)).toBe(true);
  });
});

describe("clampOrientationInput", () => {
  it("limits every angle to the supported range", () => {
    const clamped = clampOrientationInput({ tiltReadDeg: 90, tiltPhaseDeg: -120, inPlaneDeg: 46 });
    expect(clamped.tiltReadDeg).toBe(MAX_ORIENTATION_ANGLE_DEG);
    expect(clamped.tiltPhaseDeg).toBe(-MAX_ORIENTATION_ANGLE_DEG);
    expect(clamped.inPlaneDeg).toBe(MAX_ORIENTATION_ANGLE_DEG);
  });

  it("leaves in-range angles alone", () => {
    const input = angles({ tiltReadDeg: -12, tiltPhaseDeg: 7, inPlaneDeg: 0 });
    expect(clampOrientationInput(input)).toEqual(input);
  });

  it("replaces non-finite angles with zero", () => {
    const clamped = clampOrientationInput({
      tiltReadDeg: Number.NaN,
      tiltPhaseDeg: Infinity,
      inPlaneDeg: -Infinity,
    });
    expect(clamped).toEqual({ tiltReadDeg: 0, tiltPhaseDeg: 0, inPlaneDeg: 0 });
  });

  it("clamps before building, so out-of-range input still yields a valid basis", () => {
    const orientation = orientationFromAngles(angles({ tiltReadDeg: 400 }))!;
    expect(isOrthonormalOrientation(orientation, 1e-9)).toBe(true);
  });
});
