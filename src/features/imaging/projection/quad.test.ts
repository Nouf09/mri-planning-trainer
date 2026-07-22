import { describe, it, expect } from "vitest";
import {
  isDegenerateQuad,
  isFiniteQuad,
  nearestCorner,
  pointInConvexQuad,
  quadArea,
  quadCenter,
  quadEdgeMidpoint,
  quadExtent,
  quadOutwardNormal,
  topEdgeIndex,
  type ProjectedQuad,
} from "@/features/imaging/projection/quad";

/** Axis-aligned square, corners ordered clockwise on screen. */
const SQUARE: ProjectedQuad = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 200 },
  { x: 100, y: 200 },
];

/** A foreshortened parallelogram, as an oblique prescription produces. */
const SHEARED: ProjectedQuad = [
  { x: 100, y: 100 },
  { x: 260, y: 140 },
  { x: 300, y: 220 },
  { x: 140, y: 180 },
];

const COLLAPSED: ProjectedQuad = [
  { x: 100, y: 150 },
  { x: 300, y: 150 },
  { x: 300, y: 150 },
  { x: 100, y: 150 },
];

describe("quad measurements", () => {
  it("finds the centre", () => {
    expect(quadCenter(SQUARE)).toEqual({ x: 200, y: 150 });
  });

  it("computes area regardless of winding", () => {
    expect(quadArea(SQUARE)).toBeCloseTo(200 * 100, 9);
    const reversed = [...SQUARE].reverse() as unknown as ProjectedQuad;
    expect(quadArea(reversed)).toBeCloseTo(200 * 100, 9);
  });

  it("computes area for a sheared quad", () => {
    expect(quadArea(SHEARED)).toBeGreaterThan(0);
  });

  it("reports extent even when the area collapses", () => {
    expect(quadArea(COLLAPSED)).toBeCloseTo(0, 9);
    expect(quadExtent(COLLAPSED)).toBeCloseTo(200, 9);
  });

  it("detects degeneracy and non-finite corners", () => {
    expect(isDegenerateQuad(SQUARE)).toBe(false);
    expect(isDegenerateQuad(COLLAPSED)).toBe(true);
    const broken = [...SQUARE] as ProjectedPointArray;
    broken[0] = { x: Number.NaN, y: 0 };
    expect(isFiniteQuad(broken as unknown as ProjectedQuad)).toBe(false);
  });
});
type ProjectedPointArray = Array<{ x: number; y: number }>;

describe("pointInConvexQuad", () => {
  it("accepts an interior point", () => {
    expect(pointInConvexQuad({ x: 200, y: 150 }, SQUARE)).toBe(true);
  });

  it("rejects an exterior point", () => {
    expect(pointInConvexQuad({ x: 50, y: 150 }, SQUARE)).toBe(false);
    expect(pointInConvexQuad({ x: 200, y: 400 }, SQUARE)).toBe(false);
  });

  it("accepts a point on an edge", () => {
    expect(pointInConvexQuad({ x: 200, y: 100 }, SQUARE)).toBe(true);
  });

  it("accepts corners", () => {
    for (const corner of SQUARE) expect(pointInConvexQuad(corner, SQUARE)).toBe(true);
  });

  it("works for an arbitrarily sheared quad", () => {
    expect(pointInConvexQuad(quadCenter(SHEARED), SHEARED)).toBe(true);
    expect(pointInConvexQuad({ x: 0, y: 0 }, SHEARED)).toBe(false);
  });

  it("is winding independent", () => {
    const reversed = [...SQUARE].reverse() as unknown as ProjectedQuad;
    expect(pointInConvexQuad({ x: 200, y: 150 }, reversed)).toBe(true);
  });

  it("encloses nothing when collapsed", () => {
    expect(pointInConvexQuad({ x: 200, y: 150 }, COLLAPSED)).toBe(false);
  });

  it("rejects a non-finite point", () => {
    expect(pointInConvexQuad({ x: Number.NaN, y: 150 }, SQUARE)).toBe(false);
  });
});

describe("quad edges and handles", () => {
  it("finds edge midpoints", () => {
    expect(quadEdgeMidpoint(SQUARE, 0)).toEqual({ x: 200, y: 100 });
    expect(quadEdgeMidpoint(SQUARE, 2)).toEqual({ x: 200, y: 200 });
  });

  it("points edge normals away from the centre", () => {
    const normal = quadOutwardNormal(SQUARE, 0)!;
    expect(normal.y).toBeLessThan(0); // top edge points up the screen
    const bottom = quadOutwardNormal(SQUARE, 2)!;
    expect(bottom.y).toBeGreaterThan(0);
  });

  it("returns unit normals", () => {
    for (let i = 0; i < 4; i++) {
      const normal = quadOutwardNormal(SHEARED, i)!;
      expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 9);
    }
  });

  it("has no normal for a zero-length edge", () => {
    expect(quadOutwardNormal(COLLAPSED, 1)).toBeNull();
  });

  it("chooses the highest edge on screen deterministically", () => {
    expect(topEdgeIndex(SQUARE)).toBe(0);
    expect(topEdgeIndex(SQUARE)).toBe(topEdgeIndex(SQUARE));
    expect(topEdgeIndex(SHEARED)).toBe(0);
  });

  it("finds the nearest corner", () => {
    const near = nearestCorner({ x: 302, y: 103 }, SQUARE);
    expect(near.index).toBe(1);
    expect(near.distance).toBeCloseTo(Math.hypot(2, 3), 9);
  });
});

describe("quad helpers do not mutate", () => {
  it("leaves a frozen quad untouched", () => {
    const frozen = Object.freeze(SQUARE.map((c) => Object.freeze(c))) as unknown as ProjectedQuad;
    expect(() => {
      quadCenter(frozen);
      quadArea(frozen);
      topEdgeIndex(frozen);
      pointInConvexQuad({ x: 200, y: 150 }, frozen);
    }).not.toThrow();
    expect(frozen[0]).toEqual({ x: 100, y: 100 });
  });
});
