import { describe, it, expect } from "vitest";
import { boundsFromDescriptor, normalizeBounds } from "@/features/imaging/domain/volume-geometry";
import { AXIAL, CORONAL, SAGITTAL, orthonormalize } from "@/features/planning/domain/orientation";
import {
  createFittedCamera,
  planeMmToViewportPx,
} from "@/features/imaging/projection/viewport-camera";

const CUBE = boundsFromDescriptor({
  widthMm: 300,
  heightMm: 300,
  depthMm: 300,
  center: { x: 0, y: 0, z: 0 },
});
const VIEWPORT = { width: 600, height: 600 };

describe("createFittedCamera scale", () => {
  it("fits the source extent to the viewport", () => {
    const camera = createFittedCamera(CUBE, AXIAL, VIEWPORT)!;
    expect(camera.pxPerMmU).toBeCloseTo(2, 9);
    expect(camera.pxPerMmV).toBeCloseTo(2, 9);
  });

  it("scales each screen axis independently", () => {
    const bounds = boundsFromDescriptor({
      widthMm: 300,
      heightMm: 150,
      depthMm: 300,
      center: { x: 0, y: 0, z: 0 },
    });
    const camera = createFittedCamera(bounds, AXIAL, { width: 600, height: 600 })!;
    expect(camera.pxPerMmU).toBeCloseTo(2, 9);
    expect(camera.pxPerMmV).toBeCloseTo(4, 9);
  });

  it("measures extent along the camera's own axes", () => {
    const bounds = boundsFromDescriptor({
      widthMm: 300,
      heightMm: 260,
      depthMm: 200,
      center: { x: 0, y: 0, z: 0 },
    });
    // Sagittal reads along +y and phases along +z.
    const camera = createFittedCamera(bounds, SAGITTAL, { width: 260, height: 200 })!;
    expect(camera.pxPerMmU).toBeCloseTo(1, 9);
    expect(camera.pxPerMmV).toBeCloseTo(1, 9);
  });

  it("places the origin at the centre of the source", () => {
    const bounds = normalizeBounds({ x: -10, y: -20, z: -30 }, { x: 90, y: 80, z: 70 });
    const camera = createFittedCamera(bounds, AXIAL, VIEWPORT)!;
    expect(camera.origin).toEqual({ x: 40, y: 30, z: 20 });
  });

  it("works for an arbitrary valid basis, with no plane-name branching", () => {
    const tilted = orthonormalize({ x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 })!;
    const camera = createFittedCamera(CUBE, tilted, VIEWPORT);
    expect(camera).not.toBeNull();
    expect(camera!.pxPerMmU).toBeGreaterThan(0);
    expect(camera!.pxPerMmV).toBeGreaterThan(0);
  });

  it("is immutable once built", () => {
    const camera = createFittedCamera(CUBE, AXIAL, VIEWPORT)!;
    expect(Object.isFrozen(camera)).toBe(true);
    expect(Object.isFrozen(camera.origin)).toBe(true);
    expect(Object.isFrozen(camera.viewport)).toBe(true);
  });
});

describe("createFittedCamera degenerate input", () => {
  it("refuses a viewport with no area", () => {
    expect(createFittedCamera(CUBE, AXIAL, { width: 0, height: 400 })).toBeNull();
    expect(createFittedCamera(CUBE, AXIAL, { width: 400, height: 0 })).toBeNull();
    expect(createFittedCamera(CUBE, AXIAL, { width: -5, height: 400 })).toBeNull();
  });

  it("refuses a non-finite viewport", () => {
    expect(createFittedCamera(CUBE, AXIAL, { width: Number.NaN, height: 400 })).toBeNull();
    expect(createFittedCamera(CUBE, AXIAL, { width: 400, height: Infinity })).toBeNull();
  });

  it("refuses a source with no extent", () => {
    const flat = normalizeBounds({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(createFittedCamera(flat, AXIAL, VIEWPORT)).toBeNull();
  });
});

describe("planeMmToViewportPx", () => {
  const camera = createFittedCamera(CUBE, AXIAL, VIEWPORT)!;

  it("maps the camera origin to the viewport centre", () => {
    expect(planeMmToViewportPx(camera, { uMm: 0, vMm: 0 })).toEqual({ x: 300, y: 300 });
  });

  it("maps the horizontal axis rightwards", () => {
    expect(planeMmToViewportPx(camera, { uMm: 50, vMm: 0 }).x).toBeCloseTo(400, 9);
  });

  it("inverts the vertical axis, because screen y grows downward", () => {
    expect(planeMmToViewportPx(camera, { uMm: 0, vMm: 50 }).y).toBeCloseTo(200, 9);
    expect(planeMmToViewportPx(camera, { uMm: 0, vMm: -50 }).y).toBeCloseTo(400, 9);
  });

  it("applies each axis scale to its own coordinate", () => {
    const bounds = boundsFromDescriptor({
      widthMm: 300,
      heightMm: 150,
      depthMm: 300,
      center: { x: 0, y: 0, z: 0 },
    });
    const wide = createFittedCamera(bounds, AXIAL, { width: 600, height: 600 })!;
    const point = planeMmToViewportPx(wide, { uMm: 10, vMm: 10 });
    expect(point.x).toBeCloseTo(320, 9);
    expect(point.y).toBeCloseTo(260, 9);
  });

  it("stays numerically stable across a wide range", () => {
    for (const mm of [-1e4, -1, 0, 1, 1e4]) {
      const point = planeMmToViewportPx(camera, { uMm: mm, vMm: mm });
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it("uses the coronal basis without knowing it is coronal", () => {
    const coronal = createFittedCamera(CUBE, CORONAL, VIEWPORT)!;
    expect(planeMmToViewportPx(coronal, { uMm: 0, vMm: 0 })).toEqual({ x: 300, y: 300 });
  });
});
