import { describe, it, expect } from "vitest";
import {
  AXIAL,
  CORONAL,
  SAGITTAL,
  VIEW_ORIENTATION_BY_PLANE,
  isOrthonormalOrientation,
  orthonormalize,
  withInPlaneRotation,
} from "@/features/planning/domain/orientation";
import {
  GEOMETRY_EPSILON,
  areVectorsEqual,
  cross,
  dot,
  isUnitVector,
  normalize,
  rotateAroundAxis,
} from "@/features/planning/domain/vector";

const TOLERANCE = 1e-9;

describe("vector helpers", () => {
  it("computes dot and cross products", () => {
    expect(dot({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32);
    expect(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("normalizes a vector to unit length", () => {
    const unit = normalize({ x: 0, y: 3, z: 4 });
    expect(unit).not.toBeNull();
    expect(isUnitVector(unit!)).toBe(true);
  });

  it("reports degenerate vectors instead of repairing them", () => {
    expect(normalize({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(normalize({ x: Number.NaN, y: 0, z: 0 })).toBeNull();
    expect(rotateAroundAxis({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 45)).toBeNull();
  });
});

describe("named orientations", () => {
  const named = [
    ["axial", AXIAL],
    ["coronal", CORONAL],
    ["sagittal", SAGITTAL],
  ] as const;

  it.each(named)("%s is a right-handed orthonormal basis", (_name, orientation) => {
    expect(isOrthonormalOrientation(orientation)).toBe(true);
  });

  it("uses the documented RAS bases", () => {
    expect(AXIAL.readDirection).toEqual({ x: 1, y: 0, z: 0 });
    expect(AXIAL.phaseDirection).toEqual({ x: 0, y: 1, z: 0 });
    expect(AXIAL.normal).toEqual({ x: 0, y: 0, z: 1 });
    // The right-handed basis puts the coronal normal posterior.
    expect(CORONAL.normal).toEqual({ x: 0, y: -1, z: 0 });
    expect(SAGITTAL.normal).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("maps every viewport plane to an orientation", () => {
    expect(VIEW_ORIENTATION_BY_PLANE.axial).toBe(AXIAL);
    expect(VIEW_ORIENTATION_BY_PLANE.coronal).toBe(CORONAL);
    expect(VIEW_ORIENTATION_BY_PLANE.sagittal).toBe(SAGITTAL);
  });

  it("rejects a left-handed basis", () => {
    const flipped = { ...AXIAL, normal: { x: 0, y: 0, z: -1 } };
    expect(isOrthonormalOrientation(flipped)).toBe(false);
  });

  it("rejects a non-unit basis", () => {
    const stretched = { ...AXIAL, readDirection: { x: 2, y: 0, z: 0 } };
    expect(isOrthonormalOrientation(stretched)).toBe(false);
  });
});

describe("withInPlaneRotation", () => {
  it("rotates the read direction within the plane", () => {
    const rotated = withInPlaneRotation(AXIAL, 90);
    expect(rotated).not.toBeNull();
    expect(areVectorsEqual(rotated!.readDirection, { x: 0, y: 1, z: 0 }, TOLERANCE)).toBe(true);
  });

  it("leaves the normal untouched", () => {
    const rotated = withInPlaneRotation(AXIAL, 37);
    expect(areVectorsEqual(rotated!.normal, AXIAL.normal, TOLERANCE)).toBe(true);
  });

  it("keeps the basis orthonormal at arbitrary angles", () => {
    for (const degrees of [-180, -45, 0, 13.5, 90, 271]) {
      const rotated = withInPlaneRotation(AXIAL, degrees);
      expect(isOrthonormalOrientation(rotated!, 1e-9)).toBe(true);
    }
  });

  it("returns approximately to the original basis after four 90 degree turns", () => {
    let orientation = AXIAL;
    for (let turn = 0; turn < 4; turn++) {
      orientation = withInPlaneRotation(orientation, 90)!;
    }
    expect(areVectorsEqual(orientation.readDirection, AXIAL.readDirection, 1e-9)).toBe(true);
    expect(areVectorsEqual(orientation.phaseDirection, AXIAL.phaseDirection, 1e-9)).toBe(true);
    expect(areVectorsEqual(orientation.normal, AXIAL.normal, 1e-9)).toBe(true);
  });

  it("is a no-op at zero degrees", () => {
    const rotated = withInPlaneRotation(CORONAL, 0);
    expect(areVectorsEqual(rotated!.readDirection, CORONAL.readDirection, TOLERANCE)).toBe(true);
  });

  it("reports failure for an orientation with no usable normal", () => {
    const degenerate = { ...AXIAL, normal: { x: 0, y: 0, z: 0 } };
    expect(withInPlaneRotation(degenerate, 45)).toBeNull();
  });
});

describe("orthonormalize", () => {
  it("rebuilds a basis from non-perpendicular inputs", () => {
    const built = orthonormalize({ x: 1, y: 0, z: 0 }, { x: 0.4, y: 1, z: 0 });
    expect(built).not.toBeNull();
    expect(isOrthonormalOrientation(built!, 1e-9)).toBe(true);
  });

  it("returns null for parallel inputs", () => {
    expect(orthonormalize({ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toBeNull();
  });

  it("returns null for degenerate inputs", () => {
    expect(orthonormalize({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
  });

  it("uses a documented default tolerance", () => {
    expect(GEOMETRY_EPSILON).toBe(1e-6);
  });
});
