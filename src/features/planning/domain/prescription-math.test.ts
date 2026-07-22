import { describe, it, expect } from "vitest";
import { AXIAL, CORONAL, SAGITTAL } from "@/features/planning/domain/orientation";
import { orientationFromAngles } from "@/features/planning/domain/prescription-orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import { boundsFromDescriptor } from "@/features/imaging/domain/volume-geometry";
import {
  coverageMm,
  projectToViewPlane,
  sliceOffsetsMm,
  sliceSpacingMm,
  viewExtentMm,
} from "@/features/planning/domain/prescription-math";

const ORIGIN = { x: 0, y: 0, z: 0 };
const COS45 = Math.cos(Math.PI / 4);

function makePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    center: { x: 0, y: 0, z: 0 },
    orientation: AXIAL,
    fovRead: 200,
    fovPhase: 100,
    sliceThickness: 5,
    sliceGap: 1,
    sliceCount: 4,
    ...overrides,
  };
}

const tilted = (tiltReadDeg: number, tiltPhaseDeg = 0, inPlaneDeg = 0) =>
  orientationFromAngles({ tiltReadDeg, tiltPhaseDeg, inPlaneDeg })!;

describe("slice geometry", () => {
  it("spaces slices by thickness plus gap", () => {
    expect(sliceSpacingMm(makePrescription())).toBe(6);
  });

  it("centres the slice stack on the prescription", () => {
    const offsets = sliceOffsetsMm(makePrescription({ sliceCount: 4 }));
    expect(offsets).toHaveLength(4);
    expect(offsets[0]).toBeCloseTo(-9, 9);
    expect(offsets[3]).toBeCloseTo(9, 9);
  });

  it("places a single slice at the centre", () => {
    expect(sliceOffsetsMm(makePrescription({ sliceCount: 1 }))).toEqual([0]);
  });

  it("produces no slices for an empty stack", () => {
    expect(sliceOffsetsMm(makePrescription({ sliceCount: 0 }))).toEqual([]);
    expect(coverageMm(makePrescription({ sliceCount: 0 }))).toBe(0);
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

describe("face-on projection", () => {
  const p = projectToViewPlane(makePrescription(), AXIAL, ORIGIN);

  it("reports full alignment", () => {
    expect(p.alignment).toBeCloseTo(1, 9);
  });

  it("keeps the field of view unforeshortened", () => {
    expect(Math.hypot(p.halfRead.uMm, p.halfRead.vMm)).toBeCloseTo(100, 9);
    expect(Math.hypot(p.halfPhase.uMm, p.halfPhase.vMm)).toBeCloseTo(50, 9);
  });

  it("produces the same rectangle the previous model produced", () => {
    expect(p.outline[0]).toEqual({ uMm: -100, vMm: -50 });
    expect(p.outline[1]).toEqual({ uMm: 100, vMm: -50 });
    expect(p.outline[2]).toEqual({ uMm: 100, vMm: 50 });
    expect(p.outline[3]).toEqual({ uMm: -100, vMm: 50 });
  });

  it("has no in-view travel along the normal", () => {
    expect(Math.hypot(p.normalStepMm.uMm, p.normalStepMm.vMm)).toBeCloseTo(0, 9);
  });
});

describe("oblique projection foreshortening", () => {
  it("shortens the phase axis by the cosine of a read tilt", () => {
    const p = projectToViewPlane(makePrescription({ orientation: tilted(45) }), AXIAL, ORIGIN);
    expect(Math.hypot(p.halfRead.uMm, p.halfRead.vMm)).toBeCloseTo(100, 9);
    expect(Math.hypot(p.halfPhase.uMm, p.halfPhase.vMm)).toBeCloseTo(50 * COS45, 9);
  });

  it("shortens the read axis by the cosine of a phase tilt", () => {
    const p = projectToViewPlane(makePrescription({ orientation: tilted(0, 45) }), AXIAL, ORIGIN);
    expect(Math.hypot(p.halfRead.uMm, p.halfRead.vMm)).toBeCloseTo(100 * COS45, 9);
    expect(Math.hypot(p.halfPhase.uMm, p.halfPhase.vMm)).toBeCloseTo(50, 9);
  });

  it("reports alignment as the cosine of the tilt", () => {
    const p = projectToViewPlane(makePrescription({ orientation: tilted(30) }), AXIAL, ORIGIN);
    expect(p.alignment).toBeCloseTo(Math.cos(Math.PI / 6), 9);
  });

  it("produces a parallelogram under compound tilt", () => {
    const p = projectToViewPlane(makePrescription({ orientation: tilted(25, 20, 15) }), AXIAL, ORIGIN);
    const side1 = { u: p.outline[1].uMm - p.outline[0].uMm, v: p.outline[1].vMm - p.outline[0].vMm };
    const side2 = { u: p.outline[2].uMm - p.outline[3].uMm, v: p.outline[2].vMm - p.outline[3].vMm };
    expect(side1.u).toBeCloseTo(side2.u, 9);
    expect(side1.v).toBeCloseTo(side2.v, 9);
  });

  it("gives the slices somewhere to travel", () => {
    const p = projectToViewPlane(makePrescription({ orientation: tilted(45) }), AXIAL, ORIGIN);
    expect(Math.hypot(p.normalStepMm.uMm, p.normalStepMm.vMm)).toBeGreaterThan(0);
  });

  it("keeps corner ordering stable", () => {
    const p = projectToViewPlane(makePrescription({ orientation: tilted(30, 10) }), AXIAL, ORIGIN);
    expect(p.outline).toHaveLength(4);
    expect(p.outline[0].uMm).toBeLessThan(p.outline[1].uMm);
  });
});

describe("perpendicular projection", () => {
  const p = projectToViewPlane(makePrescription(), CORONAL, ORIGIN);

  it("reports no alignment", () => {
    expect(p.alignment).toBeCloseTo(0, 9);
  });

  it("collapses the phase axis to nothing", () => {
    expect(Math.hypot(p.halfPhase.uMm, p.halfPhase.vMm)).toBeCloseTo(0, 9);
  });

  it("travels one millimetre in view per millimetre along the normal", () => {
    expect(Math.hypot(p.normalStepMm.uMm, p.normalStepMm.vMm)).toBeCloseTo(1, 9);
  });

  it("stays finite", () => {
    for (const corner of p.outline) {
      expect(Number.isFinite(corner.uMm) && Number.isFinite(corner.vMm)).toBe(true);
    }
  });
});

describe("anatomical positioning", () => {
  it("projects a centred prescription to the view origin", () => {
    const p = projectToViewPlane(makePrescription(), AXIAL, ORIGIN);
    expect(p.center).toEqual({ uMm: 0, vMm: 0 });
    expect(p.outOfPlaneOffsetMm).toBeCloseTo(0, 9);
  });

  it("moves with a world shift in each named view", () => {
    const moved = makePrescription({ center: { x: 30, y: -12, z: 40 } });
    expect(projectToViewPlane(moved, AXIAL, ORIGIN).center).toEqual({ uMm: 30, vMm: -12 });
    expect(projectToViewPlane(moved, CORONAL, ORIGIN).center).toEqual({ uMm: 30, vMm: 40 });
    expect(projectToViewPlane(moved, SAGITTAL, ORIGIN).center).toEqual({ uMm: -12, vMm: 40 });
  });

  it("reports pure out-of-plane translation without moving the projection", () => {
    const moved = makePrescription({ center: { x: 0, y: 0, z: 55 } });
    const p = projectToViewPlane(moved, AXIAL, ORIGIN);
    expect(p.center).toEqual({ uMm: 0, vMm: 0 });
    expect(p.outOfPlaneOffsetMm).toBeCloseTo(55, 9);
  });

  it("measures position relative to the supplied view origin", () => {
    const moved = makePrescription({ center: { x: 30, y: 0, z: 0 } });
    expect(projectToViewPlane(moved, AXIAL, { x: 10, y: 0, z: 0 }).center.uMm).toBeCloseTo(20, 9);
  });

  it("carries the centre into the outline", () => {
    const moved = makePrescription({ center: { x: 15, y: 0, z: 0 } });
    const p = projectToViewPlane(moved, AXIAL, ORIGIN);
    const midpoint = (p.outline[0].uMm + p.outline[2].uMm) / 2;
    expect(midpoint).toBeCloseTo(15, 9);
  });
});
