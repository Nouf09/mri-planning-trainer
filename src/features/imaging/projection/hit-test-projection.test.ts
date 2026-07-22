import { describe, it, expect } from "vitest";
import {
  EMPTY_PROJECTION,
  type ProjectionResult,
} from "@/features/imaging/projection/projection-model";
import {
  HANDLE_RADIUS_PX,
  ROTATE_STALK_PX,
  hitTestProjection,
} from "@/features/imaging/projection/hit-test-projection";

const CENTER = { x: 300, y: 300 };
const WIDTH = 200;
const HEIGHT = 120;

function faceProjection(rotationRad = 0): ProjectionResult {
  return {
    mode: "face",
    rectangle: { center: CENTER, widthPx: WIDTH, heightPx: HEIGHT, rotationRad },
    slab: null,
    sliceLines: [],
    outOfPlaneOffsetMm: 0,
    isVisible: true,
  };
}

function edgeProjection(): ProjectionResult {
  return {
    mode: "edge",
    rectangle: null,
    slab: { center: CENTER, widthPx: WIDTH, heightPx: 40, rotationRad: 0, thicknessPx: 40 },
    sliceLines: [],
    outOfPlaneOffsetMm: 0,
    isVisible: true,
  };
}

/** Places a point in the shape's rotated frame, as the pointer would land. */
function atLocal(localX: number, localY: number, rotationRad: number) {
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  return {
    x: CENTER.x + localX * cos - localY * sin,
    y: CENTER.y + localX * sin + localY * cos,
  };
}

describe("hitTestProjection regions", () => {
  it("reports move at the prescription centre", () => {
    expect(hitTestProjection(CENTER, faceProjection())).toBe("move");
  });

  it("reports move inside the drawn rectangle", () => {
    expect(hitTestProjection({ x: 350, y: 320 }, faceProjection())).toBe("move");
  });

  it("reports resize on every drawn corner", () => {
    const corners = [
      [-WIDTH / 2, -HEIGHT / 2],
      [WIDTH / 2, -HEIGHT / 2],
      [WIDTH / 2, HEIGHT / 2],
      [-WIDTH / 2, HEIGHT / 2],
    ] as const;
    for (const [x, y] of corners) {
      expect(hitTestProjection(atLocal(x, y, 0), faceProjection())).toBe("resize");
    }
  });

  it("reports rotate on the stalk knob", () => {
    const point = atLocal(0, -HEIGHT / 2 - ROTATE_STALK_PX, 0);
    expect(hitTestProjection(point, faceProjection())).toBe("rotate");
  });

  it("reports nothing outside the prescription", () => {
    expect(hitTestProjection({ x: 10, y: 10 }, faceProjection())).toBeNull();
    expect(hitTestProjection({ x: 599, y: 599 }, faceProjection())).toBeNull();
  });

  it("prefers the rotate knob over the rectangle body", () => {
    // The knob sits outside the rectangle, so it can only be the rotate handle.
    const point = atLocal(0, -HEIGHT / 2 - ROTATE_STALK_PX, 0);
    expect(hitTestProjection(point, faceProjection())).not.toBe("move");
  });
});

describe("hitTestProjection follows the drawn rotation", () => {
  const rotation = -Math.PI / 4;

  it("finds corners after rotation", () => {
    const point = atLocal(WIDTH / 2, HEIGHT / 2, rotation);
    expect(hitTestProjection(point, faceProjection(rotation))).toBe("resize");
  });

  it("finds the rotate knob after rotation", () => {
    const point = atLocal(0, -HEIGHT / 2 - ROTATE_STALK_PX, rotation);
    expect(hitTestProjection(point, faceProjection(rotation))).toBe("rotate");
  });

  it("no longer reports the unrotated corner position", () => {
    const unrotatedCorner = { x: CENTER.x + WIDTH / 2, y: CENTER.y + HEIGHT / 2 };
    expect(hitTestProjection(unrotatedCorner, faceProjection(rotation))).not.toBe("resize");
  });

  it("still reports move at the centre of a rotated shape", () => {
    expect(hitTestProjection(CENTER, faceProjection(rotation))).toBe("move");
  });
});

describe("hitTestProjection edge-on slab", () => {
  it("tests against the slab when there is no rectangle", () => {
    expect(hitTestProjection(CENTER, edgeProjection())).toBe("move");
  });

  it("uses the slab's own corners", () => {
    const point = { x: CENTER.x + WIDTH / 2, y: CENTER.y + 20 };
    expect(hitTestProjection(point, edgeProjection())).toBe("resize");
  });
});

describe("hitTestProjection boundaries and options", () => {
  it("treats the handle radius as exclusive", () => {
    const justInside = atLocal(WIDTH / 2, -HEIGHT / 2 + HANDLE_RADIUS_PX - 0.01, 0);
    expect(hitTestProjection(justInside, faceProjection())).toBe("resize");
  });

  it("misses a corner beyond the handle radius", () => {
    const outside = atLocal(WIDTH / 2 + HANDLE_RADIUS_PX + 5, -HEIGHT / 2 - HANDLE_RADIUS_PX - 5, 0);
    expect(hitTestProjection(outside, faceProjection())).toBeNull();
  });

  it("accepts a custom handle radius", () => {
    const point = atLocal(WIDTH / 2 - 20, HEIGHT / 2 - 20, 0);
    expect(hitTestProjection(point, faceProjection())).toBe("move");
    expect(hitTestProjection(point, faceProjection(), { handleRadiusPx: 40 })).toBe("resize");
  });

  it("accepts a custom rotate stalk length", () => {
    const point = atLocal(0, -HEIGHT / 2 - 60, 0);
    expect(hitTestProjection(point, faceProjection())).toBeNull();
    expect(hitTestProjection(point, faceProjection(), { rotateStalkPx: 60 })).toBe("rotate");
  });
});

describe("hitTestProjection guards", () => {
  it("reports nothing for an invisible projection", () => {
    expect(hitTestProjection(CENTER, EMPTY_PROJECTION)).toBeNull();
  });

  it("reports nothing when there is no shape", () => {
    const shapeless: ProjectionResult = { ...faceProjection(), rectangle: null };
    expect(hitTestProjection(CENTER, shapeless)).toBeNull();
  });

  it("reports nothing for a non-finite pointer", () => {
    expect(hitTestProjection({ x: Number.NaN, y: 300 }, faceProjection())).toBeNull();
  });

  it("does not mutate the projection it inspects", () => {
    const projection = Object.freeze(faceProjection());
    expect(() => hitTestProjection(CENTER, projection)).not.toThrow();
    expect(projection.rectangle!.center).toEqual(CENTER);
  });
});
