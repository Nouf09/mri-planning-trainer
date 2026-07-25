import { describe, it, expect } from "vitest";
import {
  NEGLIGIBLE_COMPONENT,
  directionFromNormal,
  oppositeDirection,
  positionForOffset,
  type AnatomicalPosition,
} from "@/features/imaging/domain/anatomical-direction";

/** Narrows a position to its axis code, so the centre cannot be read as one. */
function codeOf(position: AnatomicalPosition | null): string | null {
  return position && position.kind === "offset" ? position.code : null;
}

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

describe("opposite directions", () => {
  const direction = (code: string, description: string) => ({ code, description });

  it("swaps each axis for the other end of the same axis", () => {
    expect(oppositeDirection(direction("R", "Right"))?.code).toBe("L");
    expect(oppositeDirection(direction("L", "Left"))?.code).toBe("R");
    expect(oppositeDirection(direction("A", "Anterior"))?.code).toBe("P");
    expect(oppositeDirection(direction("P", "Posterior"))?.code).toBe("A");
    expect(oppositeDirection(direction("S", "Superior"))?.code).toBe("I");
    expect(oppositeDirection(direction("I", "Inferior"))?.code).toBe("S");
  });

  it("carries the words along with the letters", () => {
    expect(oppositeDirection(direction("S", "Superior"))?.description).toBe("Inferior");
    expect(oppositeDirection(direction("S-P", "Superior, then Posterior"))?.description).toBe(
      "Inferior, then Anterior"
    );
  });

  it("keeps component order for compound directions", () => {
    expect(oppositeDirection(direction("S-P", "Superior, then Posterior"))?.code).toBe("I-A");
    // Order is preserved, not reversed: R-S-P becomes L-I-A, never A-I-L.
    expect(oppositeDirection(direction("R-S-P", "Right, then Superior, then Posterior"))?.code).toBe(
      "L-I-A"
    );
  });

  it("returns to the original when applied twice", () => {
    for (const code of ["S", "I", "R-S", "R-S-P", "L-A-I"]) {
      const once = oppositeDirection(direction(code, ""));
      expect(once).not.toBeNull();
      expect(oppositeDirection(once!)?.code).toBe(code);
    }
  });

  it("rejects a code it did not produce", () => {
    expect(oppositeDirection(direction("Q", "Quixotic"))).toBeNull();
    expect(oppositeDirection(direction("", ""))).toBeNull();
    expect(oppositeDirection(direction("S-", "Superior"))).toBeNull();
    expect(oppositeDirection(direction("S-Q", "Superior"))).toBeNull();
    expect(oppositeDirection(direction("s", "Superior"))).toBeNull();
  });
});

describe("signed anatomical position", () => {
  const superior = { code: "S", description: "Superior" };
  const superiorPosterior = { code: "S-P", description: "Superior, then Posterior" };
  const compound = { code: "R-S-P", description: "Right, then Superior, then Posterior" };

  it("keeps the direction for a positive offset", () => {
    expect(positionForOffset(superior, 15)).toEqual({
      kind: "offset",
      code: "S",
      description: "Superior",
    });
    expect(codeOf(positionForOffset(superiorPosterior, 15))).toBe("S-P");
    expect(codeOf(positionForOffset(compound, 3))).toBe("R-S-P");
  });

  it("reads the opposite axes for a negative offset", () => {
    expect(positionForOffset(superior, -15)).toEqual({
      kind: "offset",
      code: "I",
      description: "Inferior",
    });
    expect(codeOf(positionForOffset(superiorPosterior, -15))).toBe("I-A");
    expect(codeOf(positionForOffset(compound, -3))).toBe("L-I-A");
  });

  it("reports the centre for a zero offset", () => {
    expect(positionForOffset(superior, 0)).toEqual({ kind: "centre" });
  });

  it("reports the centre for negative zero", () => {
    expect(positionForOffset(superior, -0)).toEqual({ kind: "centre" });
  });

  it("treats the boundary as exactly zero, not as a tolerance", () => {
    expect(positionForOffset(superior, 1e-9)?.kind).toBe("offset");
    expect(positionForOffset(superior, -1e-9)).toEqual({
      kind: "offset",
      code: "I",
      description: "Inferior",
    });
  });

  it("is the centre even when the direction names no axis", () => {
    expect(positionForOffset(null, 0)).toEqual({ kind: "centre" });
  });

  it("names nothing away from the centre without a direction", () => {
    expect(positionForOffset(null, 15)).toBeNull();
    expect(positionForOffset(null, -15)).toBeNull();
  });

  it("names nothing for a non-finite offset", () => {
    expect(positionForOffset(superior, Number.NaN)).toBeNull();
    expect(positionForOffset(superior, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("names nothing when the direction cannot be opposed", () => {
    expect(positionForOffset({ code: "Q", description: "Quixotic" }, -5)).toBeNull();
  });
});

describe("the opposite of a direction matches re-deriving from the negated vector", () => {
  const normals = [
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: -0.7071, z: 0.7071 },
    { x: 0.7071, y: 0, z: 0.7071 },
    { x: 0.5, y: -0.433, z: 0.75 },
    { x: 0.707, y: -0.5, z: 0.5 },
  ];

  it("holds for every representative normal", () => {
    for (const normal of normals) {
      const forward = directionFromNormal(normal);
      expect(forward).not.toBeNull();
      const negated = directionFromNormal({ x: -normal.x, y: -normal.y, z: -normal.z });
      expect(negated).toEqual(oppositeDirection(forward!));
    }
  });
});
