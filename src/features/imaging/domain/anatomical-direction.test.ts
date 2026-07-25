import { describe, it, expect } from "vitest";
import {
  NEGLIGIBLE_COMPONENT,
  directionFromNormal,
} from "@/features/imaging/domain/anatomical-direction";

describe("cardinal directions", () => {
  it("names each axis toward the patient", () => {
    expect(directionFromNormal({ x: 1, y: 0, z: 0 })?.code).toBe("R");
    expect(directionFromNormal({ x: 0, y: 1, z: 0 })?.code).toBe("A");
    expect(directionFromNormal({ x: 0, y: 0, z: 1 })?.code).toBe("S");
  });

  it("names each axis away from the patient", () => {
    expect(directionFromNormal({ x: -1, y: 0, z: 0 })?.code).toBe("L");
    expect(directionFromNormal({ x: 0, y: -1, z: 0 })?.code).toBe("P");
    expect(directionFromNormal({ x: 0, y: 0, z: -1 })?.code).toBe("I");
  });

  it("describes a single axis as one word", () => {
    expect(directionFromNormal({ x: 0, y: 0, z: 1 })?.description).toBe("Superior");
    expect(directionFromNormal({ x: 0, y: 0, z: -1 })?.description).toBe("Inferior");
  });
});

describe("oblique directions", () => {
  it("orders the axes by decreasing magnitude", () => {
    // Dominated by superior, then right, then posterior.
    const direction = directionFromNormal({ x: 0.5, y: -0.433, z: 0.75 });
    expect(direction?.code).toBe("S-R-P");
    expect(direction?.description).toBe("Superior, then Right, then Posterior");
  });

  it("does not report a steeply tilted normal as a pure axis", () => {
    // The reachable extreme of the planning model: dominated by right, not
    // superior, so the strongest letter must not be S.
    const direction = directionFromNormal({ x: 0.707, y: -0.5, z: 0.5 });
    expect(direction?.code.startsWith("R")).toBe(true);
    expect(direction?.code).toBe("R-P-S");
  });

  it("keeps a stable axis order for equally strong components", () => {
    // A 45 degree direction between two axes names both, y before z.
    expect(directionFromNormal({ x: 0, y: -0.7071, z: 0.7071 })?.code).toBe("P-S");
    expect(directionFromNormal({ x: 0.7071, y: 0, z: 0.7071 })?.code).toBe("R-S");
    expect(directionFromNormal({ x: 0.7071, y: 0.7071, z: 0 })?.code).toBe("R-A");
  });
});

describe("negligible components", () => {
  it("ignores components at or below the epsilon", () => {
    const direction = directionFromNormal({ x: NEGLIGIBLE_COMPONENT, y: -1e-9, z: 1 });
    expect(direction?.code).toBe("S");
  });

  it("reports a component just above the epsilon", () => {
    const direction = directionFromNormal({ x: NEGLIGIBLE_COMPONENT * 2, y: 0, z: 1 });
    expect(direction?.code).toBe("S-R");
  });
});

describe("no direction to name", () => {
  it("returns null for a zero-length vector", () => {
    expect(directionFromNormal({ x: 0, y: 0, z: 0 })).toBeNull();
  });

  it("returns null for a non-finite vector", () => {
    expect(directionFromNormal({ x: Number.NaN, y: 0, z: 1 })).toBeNull();
    expect(directionFromNormal({ x: 0, y: Number.POSITIVE_INFINITY, z: 1 })).toBeNull();
  });
});
