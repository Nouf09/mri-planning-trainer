import { describe, it, expect } from "vitest";
import { AXIAL, CORONAL, SAGITTAL, withInPlaneRotation } from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import { boundsFromDescriptor } from "@/features/imaging/domain/volume-geometry";
import {
  coverageMm,
  projectToViewPlane,
  sliceOffsetsMm,
  sliceSpacingMm,
  viewExtentMm,
} from "@/features/planning/domain/prescription-math";

const TOLERANCE = 1e-9;
const ORIGIN = { x: 0, y: 0, z: 0 };

function makePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    center: { x: 0, y: 0, z: 0 },
    orientation: AXIAL,
    fovRead: 230,
    fovPhase: 200,
    sliceThickness: 5,
    sliceGap: 1,
    sliceCount: 10,
    ...overrides,
  };
}

describe("slice geometry", () => {
  it("spaces slices by thickness plus gap", () => {
    expect(sliceSpacingMm(makePrescription())).toBe(6);
  });

  it("centres the slice stack on the prescription", () => {
    const offsets = sliceOffsetsMm(makePrescription({ sliceCount: 4 }));
    expect(offsets).toHaveLength(4);
    expect(offsets[0]).toBeCloseTo(-9, 9);
    expect(offsets[3]).toBeCloseTo(9, 9);
    expect(offsets[0] + offsets[3]).toBeCloseTo(0, 9);
  });

  it("places a single slice at the centre", () => {
    expect(sliceOffsetsMm(makePrescription({ sliceCount: 1 }))).toEqual([0]);
  });

  it("produces no slices for an empty stack", () => {
    expect(sliceOffsetsMm(makePrescription({ sliceCount: 0 }))).toEqual([]);
    expect(coverageMm(makePrescription({ sliceCount: 0 }))).toBe(0);
  });

  it("handles a contiguous stack with no gap", () => {
    const offsets = sliceOffsetsMm(makePrescription({ sliceCount: 3, sliceGap: 0 }));
    expect(offsets).toEqual([-5, 0, 5]);
  });

  it("computes coverage as slices plus the gaps between them", () => {
    expect(coverageMm(makePrescription({ sliceCount: 10 }))).toBe(10 * 5 + 9 * 1);
  });
});

describe("viewExtentMm", () => {
  const world = boundsFromDescriptor({ widthMm: 300, heightMm: 260, depthMm: 200, center: ORIGIN });

  it("measures the source along each view's own axes", () => {
    expect(viewExtentMm(world, AXIAL)).toEqual({ uMm: 300, vMm: 260 });
    expect(viewExtentMm(world, CORONAL)).toEqual({ uMm: 300, vMm: 200 });
    expect(viewExtentMm(world, SAGITTAL)).toEqual({ uMm: 260, vMm: 200 });
  });
});

describe("projection into the prescription's own plane", () => {
  it("shows the field of view face on, without slice lines", () => {
    const projection = projectToViewPlane(makePrescription(), AXIAL, ORIGIN);
    expect(projection.isEdgeOn).toBe(false);
    expect(projection.widthMm).toBe(230);
    expect(projection.heightMm).toBe(200);
    expect(projection.sliceLines).toEqual([]);
  });

  it("reports in-plane rotation", () => {
    const rotated = makePrescription({ orientation: withInPlaneRotation(AXIAL, 30)! });
    const projection = projectToViewPlane(rotated, AXIAL, ORIGIN);
    expect(projection.rotationDeg).toBeCloseTo(30, 6);
  });

  it("does not leak in-plane rotation into perpendicular views", () => {
    const rotated = makePrescription({ orientation: withInPlaneRotation(AXIAL, 30)! });
    expect(projectToViewPlane(rotated, CORONAL, ORIGIN).rotationDeg).toBe(0);
  });
});

describe("projection into perpendicular planes", () => {
  it("shows the slab edge on in coronal", () => {
    const projection = projectToViewPlane(makePrescription(), CORONAL, ORIGIN);
    expect(projection.isEdgeOn).toBe(true);
    // Coronal u is +x, which carries the read field of view.
    expect(projection.widthMm).toBeCloseTo(230, 9);
    // Coronal v is +z, along the slice normal, so it shows the slab.
    expect(projection.heightMm).toBeCloseTo(coverageMm(makePrescription()), 9);
  });

  it("shows the slab edge on in sagittal", () => {
    const projection = projectToViewPlane(makePrescription(), SAGITTAL, ORIGIN);
    expect(projection.isEdgeOn).toBe(true);
    // Sagittal u is +y, which carries the phase field of view.
    expect(projection.widthMm).toBeCloseTo(200, 9);
    expect(projection.heightMm).toBeCloseTo(coverageMm(makePrescription()), 9);
  });

  it("draws one boundary per slice, spanning the field of view", () => {
    const prescription = makePrescription({ sliceCount: 4 });
    const projection = projectToViewPlane(prescription, CORONAL, ORIGIN);
    expect(projection.sliceLines).toHaveLength(4);
    for (const line of projection.sliceLines) {
      expect(line.start.vMm).toBeCloseTo(line.end.vMm, 9);
      expect(line.end.uMm - line.start.uMm).toBeCloseTo(projection.widthMm, 9);
    }
  });

  it("stacks slice boundaries along the view's slab axis", () => {
    const projection = projectToViewPlane(makePrescription({ sliceCount: 4 }), CORONAL, ORIGIN);
    const positions = projection.sliceLines.map((line) => line.start.vMm);
    expect(positions[1] - positions[0]).toBeCloseTo(6, 9);
  });
});

describe("anatomical positioning", () => {
  it("projects a centred prescription to the view origin", () => {
    const projection = projectToViewPlane(makePrescription(), AXIAL, ORIGIN);
    expect(projection.center.uMm).toBeCloseTo(0, 9);
    expect(projection.center.vMm).toBeCloseTo(0, 9);
    expect(projection.outOfPlaneOffsetMm).toBeCloseTo(0, 9);
  });

  it("moves the axial projection with a world x shift", () => {
    const moved = makePrescription({ center: { x: 30, y: 0, z: 0 } });
    const projection = projectToViewPlane(moved, AXIAL, ORIGIN);
    expect(projection.center.uMm).toBeCloseTo(30, 9);
    expect(projection.center.vMm).toBeCloseTo(0, 9);
  });

  it("moves the axial projection with a world y shift", () => {
    const moved = makePrescription({ center: { x: 0, y: -12, z: 0 } });
    const projection = projectToViewPlane(moved, AXIAL, ORIGIN);
    expect(projection.center.uMm).toBeCloseTo(0, 9);
    expect(projection.center.vMm).toBeCloseTo(-12, 9);
  });

  it("moves the coronal projection along its own axes", () => {
    const moved = makePrescription({ center: { x: 25, y: 0, z: 40 } });
    const projection = projectToViewPlane(moved, CORONAL, ORIGIN);
    expect(projection.center.uMm).toBeCloseTo(25, 9);
    expect(projection.center.vMm).toBeCloseTo(40, 9);
  });

  it("moves the sagittal projection along its own axes", () => {
    const moved = makePrescription({ center: { x: 0, y: 18, z: -7 } });
    const projection = projectToViewPlane(moved, SAGITTAL, ORIGIN);
    expect(projection.center.uMm).toBeCloseTo(18, 9);
    expect(projection.center.vMm).toBeCloseTo(-7, 9);
  });

  it("reports pure out-of-plane translation without moving the projection", () => {
    const moved = makePrescription({ center: { x: 0, y: 0, z: 55 } });
    const projection = projectToViewPlane(moved, AXIAL, ORIGIN);
    expect(projection.center.uMm).toBeCloseTo(0, 9);
    expect(projection.center.vMm).toBeCloseTo(0, 9);
    expect(projection.outOfPlaneOffsetMm).toBeCloseTo(55, 9);
  });

  it("measures out-of-plane offset along the view normal", () => {
    // The coronal normal points posterior, so an anterior shift is negative.
    const moved = makePrescription({ center: { x: 0, y: 20, z: 0 } });
    expect(projectToViewPlane(moved, CORONAL, ORIGIN).outOfPlaneOffsetMm).toBeCloseTo(-20, 9);
  });

  it("measures position relative to the supplied view origin", () => {
    const moved = makePrescription({ center: { x: 30, y: 0, z: 0 } });
    const projection = projectToViewPlane(moved, AXIAL, { x: 10, y: 0, z: 0 });
    expect(projection.center.uMm).toBeCloseTo(20, 9);
  });

  it("carries the centre through to slice line positions", () => {
    const moved = makePrescription({ sliceCount: 2, center: { x: 15, y: 0, z: 0 } });
    const projection = projectToViewPlane(moved, CORONAL, ORIGIN);
    for (const line of projection.sliceLines) {
      const midpoint = (line.start.uMm + line.end.uMm) / 2;
      expect(midpoint).toBeCloseTo(15, 9);
    }
  });

  it("keeps projections finite for a degenerate stack", () => {
    const projection = projectToViewPlane(makePrescription({ sliceCount: 0 }), CORONAL, ORIGIN);
    expect(Number.isFinite(projection.widthMm)).toBe(true);
    expect(projection.sliceLines).toEqual([]);
    expect(Math.abs(projection.heightMm)).toBeLessThan(TOLERANCE + 1);
  });
});
