import { describe, it, expect } from "vitest";
import {
  EMPTY_PROJECTION,
  type ProjectionResult,
} from "@/features/imaging/projection/projection-model";
import type { ProjectedQuad } from "@/features/imaging/projection/quad";
import {
  HANDLE_RADIUS_PX,
  hitTestProjection,
  rotateKnobPosition,
} from "@/features/imaging/projection/hit-test-projection";

const SQUARE: ProjectedQuad = [
  { x: 200, y: 200 },
  { x: 400, y: 200 },
  { x: 400, y: 320 },
  { x: 200, y: 320 },
];

/** Foreshortened outline, as an oblique prescription produces. */
const OBLIQUE: ProjectedQuad = [
  { x: 200, y: 200 },
  { x: 380, y: 240 },
  { x: 420, y: 340 },
  { x: 240, y: 300 },
];

function projection(outline: ProjectedQuad | null = SQUARE): ProjectionResult {
  return {
    mode: "face",
    outline,
    sliceOutlines: [],
    normalStepPx: { x: 0, y: 0 },
    outOfPlaneOffsetMm: 0,
    isVisible: true,
  };
}

describe("hitTestProjection regions", () => {
  it("reports move inside the drawn outline", () => {
    expect(hitTestProjection({ x: 300, y: 260 }, projection())).toBe("move");
  });

  it("reports resize on every drawn corner", () => {
    for (const corner of SQUARE) {
      expect(hitTestProjection(corner, projection())).toBe("resize");
    }
  });

  it("reports rotate on the knob", () => {
    const knob = rotateKnobPosition(SQUARE)!;
    expect(hitTestProjection(knob, projection())).toBe("rotate");
  });

  it("reports nothing outside", () => {
    expect(hitTestProjection({ x: 10, y: 10 }, projection())).toBeNull();
    expect(hitTestProjection({ x: 300, y: 500 }, projection())).toBeNull();
  });
});

describe("hitTestProjection follows oblique geometry", () => {
  it("finds move inside a foreshortened outline", () => {
    expect(hitTestProjection({ x: 310, y: 270 }, projection(OBLIQUE))).toBe("move");
  });

  it("finds every projected corner of a foreshortened outline", () => {
    for (const corner of OBLIQUE) {
      expect(hitTestProjection(corner, projection(OBLIQUE))).toBe("resize");
    }
  });

  it("moves the knob with the outline", () => {
    const knob = rotateKnobPosition(OBLIQUE)!;
    expect(hitTestProjection(knob, projection(OBLIQUE))).toBe("rotate");
    // The upright knob position is no longer the handle once the outline tilts.
    expect(hitTestProjection(rotateKnobPosition(SQUARE)!, projection(OBLIQUE))).not.toBe("rotate");
  });

  it("rejects a point the upright outline covered but the tilted one does not", () => {
    const point = { x: 250, y: 210 };
    expect(hitTestProjection(point, projection(SQUARE))).toBe("move");
    expect(hitTestProjection(point, projection(OBLIQUE))).toBeNull();
  });
});

describe("hitTestProjection guards", () => {
  it("reports nothing for an invisible projection", () => {
    expect(hitTestProjection({ x: 300, y: 260 }, EMPTY_PROJECTION)).toBeNull();
  });

  it("reports nothing without an outline", () => {
    expect(hitTestProjection({ x: 300, y: 260 }, projection(null))).toBeNull();
  });

  it("reports nothing for a non-finite pointer", () => {
    expect(hitTestProjection({ x: Number.NaN, y: 260 }, projection())).toBeNull();
  });

  it("stays safe for an edge-on collapsed outline", () => {
    const collapsed: ProjectedQuad = [
      { x: 200, y: 260 },
      { x: 400, y: 260 },
      { x: 400, y: 260 },
      { x: 200, y: 260 },
    ];
    expect(hitTestProjection({ x: 300, y: 260 }, projection(collapsed))).not.toBe("move");
    expect(() => hitTestProjection({ x: 300, y: 260 }, projection(collapsed))).not.toThrow();
  });

  it("accepts a custom handle radius", () => {
    const nearCorner = { x: 200 + HANDLE_RADIUS_PX + 5, y: 200 + HANDLE_RADIUS_PX + 5 };
    expect(hitTestProjection(nearCorner, projection())).toBe("move");
    expect(hitTestProjection(nearCorner, projection(), { handleRadiusPx: 40 })).toBe("resize");
  });

  it("does not mutate a frozen projection", () => {
    const frozen = Object.freeze(projection());
    expect(() => hitTestProjection({ x: 300, y: 260 }, frozen)).not.toThrow();
    expect(frozen.outline![0]).toEqual({ x: 200, y: 200 });
  });
});
