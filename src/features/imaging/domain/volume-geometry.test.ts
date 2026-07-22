import { describe, it, expect } from "vitest";
import {
  boundsCenter,
  boundsFromDescriptor,
  boundsSize,
  normalizeBounds,
  resolvePlanningBounds,
  type VolumeGeometry,
} from "@/features/imaging/domain/volume-geometry";

const SYNTHETIC = boundsFromDescriptor({
  widthMm: 300,
  heightMm: 300,
  depthMm: 300,
  center: { x: 0, y: 0, z: 0 },
});

function makeGeometry(): VolumeGeometry {
  const bounds = normalizeBounds({ x: -90, y: -126, z: -72 }, { x: 90, y: 90, z: 108 });
  return {
    dimensionsVox: { x: 180, y: 216, z: 180 },
    spacingMm: { x: 1, y: 1, z: 1 },
    bounds,
    center: boundsCenter(bounds),
    obliquity: { angleDeg: 0, maxShearDeg: 0 },
    coordinateSystem: "niivue-ortho-mm",
  };
}

describe("bounds helpers", () => {
  it("orders corners regardless of axis direction", () => {
    const bounds = normalizeBounds({ x: 10, y: -5, z: 3 }, { x: -10, y: 5, z: -3 });
    expect(bounds.min).toEqual({ x: -10, y: -5, z: -3 });
    expect(bounds.max).toEqual({ x: 10, y: 5, z: 3 });
  });

  it("computes size and centre", () => {
    const bounds = normalizeBounds({ x: -90, y: -126, z: -72 }, { x: 90, y: 90, z: 108 });
    expect(boundsSize(bounds)).toEqual({ x: 180, y: 216, z: 180 });
    expect(boundsCenter(bounds)).toEqual({ x: 0, y: -18, z: 18 });
  });

  it("derives bounds from a synthetic descriptor", () => {
    expect(SYNTHETIC.min).toEqual({ x: -150, y: -150, z: -150 });
    expect(SYNTHETIC.max).toEqual({ x: 150, y: 150, z: 150 });
  });

  it("keeps an off-origin descriptor centred where it says", () => {
    const bounds = boundsFromDescriptor({
      widthMm: 100,
      heightMm: 100,
      depthMm: 100,
      center: { x: 10, y: 20, z: 30 },
    });
    expect(boundsCenter(bounds)).toEqual({ x: 10, y: 20, z: 30 });
  });
});

describe("resolvePlanningBounds", () => {
  it("uses the synthetic extent for the JPG source", () => {
    expect(resolvePlanningBounds("jpg", null, SYNTHETIC)).toBe(SYNTHETIC);
  });

  it("uses the real volume's own extent", () => {
    const geometry = makeGeometry();
    expect(resolvePlanningBounds("niivue", geometry, SYNTHETIC)).toBe(geometry.bounds);
  });

  it("has no bounds for a volume whose geometry is unknown", () => {
    expect(resolvePlanningBounds("niivue", null, SYNTHETIC)).toBeNull();
  });

  it("never hands the synthetic extent to a real volume", () => {
    // The invariant this whole phase exists to protect.
    for (const geometry of [null, makeGeometry()]) {
      expect(resolvePlanningBounds("niivue", geometry, SYNTHETIC)).not.toBe(SYNTHETIC);
    }
  });

  it("never hands the synthetic extent to an unknown engine", () => {
    expect(resolvePlanningBounds("bogus" as never, null, SYNTHETIC)).toBeNull();
  });
});
