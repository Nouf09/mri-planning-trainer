import { describe, it, expect } from "vitest";
import { boundsFromDescriptor } from "@/features/imaging/domain/volume-geometry";
import { AXIAL, CORONAL } from "@/features/planning/domain/orientation";
import { orientationFromAngles } from "@/features/planning/domain/prescription-orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import { createFittedCamera } from "@/features/imaging/projection/viewport-camera";
import { projectPrescription } from "@/features/imaging/projection/project-prescription";
import {
  ORTHOGONAL_TOLERANCE_DEG,
  classifyProjectionMode,
} from "@/features/imaging/projection/projection-model";
import { quadArea, quadCenter } from "@/features/imaging/projection/quad";

const CUBE = boundsFromDescriptor({ widthMm: 300, heightMm: 300, depthMm: 300, center: { x: 0, y: 0, z: 0 } });
const VIEWPORT = { width: 600, height: 600 }; // 2 px per mm
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

const axial = () => createFittedCamera(CUBE, AXIAL, VIEWPORT)!;
const coronal = () => createFittedCamera(CUBE, CORONAL, VIEWPORT)!;
const tilted = (r: number, p = 0, i = 0) => orientationFromAngles({ tiltReadDeg: r, tiltPhaseDeg: p, inPlaneDeg: i })!;

describe("face-on projection", () => {
  const result = projectPrescription(makePrescription(), axial());

  it("classifies as face", () => {
    expect(result.mode).toBe("face");
    expect(result.isVisible).toBe(true);
  });

  it("reproduces the previous rectangle exactly", () => {
    expect(result.outline![0]).toEqual({ x: 100, y: 400 });
    expect(result.outline![1]).toEqual({ x: 500, y: 400 });
    expect(result.outline![2]).toEqual({ x: 500, y: 200 });
    expect(result.outline![3]).toEqual({ x: 100, y: 200 });
  });

  it("centres a centred prescription", () => {
    expect(quadCenter(result.outline!)).toEqual({ x: 300, y: 300 });
  });

  it("has no travel along the normal, so slices coincide", () => {
    expect(result.normalStepPx).toEqual({ x: 0, y: -0 });
    expect(result.sliceOutlines).toHaveLength(4);
  });
});

describe("oblique projection", () => {
  it("foreshortens by the cosine of the tilt", () => {
    const upright = projectPrescription(makePrescription(), axial());
    const oblique = projectPrescription(makePrescription({ orientation: tilted(45) }), axial());
    expect(quadArea(oblique.outline!)).toBeCloseTo(quadArea(upright.outline!) * COS45, 6);
  });

  it("classifies as oblique", () => {
    expect(projectPrescription(makePrescription({ orientation: tilted(30) }), axial()).mode).toBe("oblique");
  });

  it("keeps opposite edges parallel", () => {
    const r = projectPrescription(makePrescription({ orientation: tilted(25, 20, 15) }), axial());
    const q = r.outline!;
    expect(q[1].x - q[0].x).toBeCloseTo(q[2].x - q[3].x, 9);
    expect(q[1].y - q[0].y).toBeCloseTo(q[2].y - q[3].y, 9);
  });

  it("separates slice outlines along the projected normal", () => {
    const r = projectPrescription(makePrescription({ orientation: tilted(45) }), axial());
    expect(r.sliceOutlines).toHaveLength(4);
    const first = quadCenter(r.sliceOutlines[0]);
    const second = quadCenter(r.sliceOutlines[1]);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(0);
  });

  it("translates every slice by the same step", () => {
    const r = projectPrescription(makePrescription({ orientation: tilted(45) }), axial());
    const centres = r.sliceOutlines.map(quadCenter);
    const step1 = { x: centres[1].x - centres[0].x, y: centres[1].y - centres[0].y };
    const step2 = { x: centres[2].x - centres[1].x, y: centres[2].y - centres[1].y };
    expect(step1.x).toBeCloseTo(step2.x, 9);
    expect(step1.y).toBeCloseTo(step2.y, 9);
  });
});

describe("edge-on projection", () => {
  const result = projectPrescription(makePrescription(), coronal());

  it("classifies as edge", () => {
    expect(result.mode).toBe("edge");
  });

  it("collapses the outline without becoming invalid", () => {
    expect(quadArea(result.outline!)).toBeCloseTo(0, 6);
    expect(result.isVisible).toBe(true);
    for (const corner of result.outline!) {
      expect(Number.isFinite(corner.x) && Number.isFinite(corner.y)).toBe(true);
    }
  });

  it("spreads the slices apart", () => {
    const centres = result.sliceOutlines.map(quadCenter);
    expect(Math.abs(centres[1].y - centres[0].y)).toBeCloseTo(12, 9); // 6 mm pitch at 2 px/mm
  });
});

describe("anisotropic and translated cameras", () => {
  it("applies each axis scale independently", () => {
    const bounds = boundsFromDescriptor({ widthMm: 300, heightMm: 150, depthMm: 300, center: { x: 0, y: 0, z: 0 } });
    const camera = createFittedCamera(bounds, AXIAL, VIEWPORT)!;
    const r = projectPrescription(makePrescription(), camera);
    expect(r.outline![1].x - r.outline![0].x).toBeCloseTo(200 * 2, 9);
    expect(r.outline![0].y - r.outline![3].y).toBeCloseTo(100 * 4, 9);
  });

  it("moves with the prescription centre", () => {
    const r = projectPrescription(makePrescription({ center: { x: 50, y: 0, z: 0 } }), axial());
    expect(quadCenter(r.outline!).x).toBeCloseTo(400, 9);
  });
});

describe("classification rules", () => {
  it("uses one named tolerance", () => {
    expect(ORTHOGONAL_TOLERANCE_DEG).toBe(1);
  });

  it("classifies exact parallel and perpendicular", () => {
    expect(classifyProjectionMode(1)).toBe("face");
    expect(classifyProjectionMode(0)).toBe("edge");
  });

  it("classifies just inside each tolerance", () => {
    expect(classifyProjectionMode(Math.cos((0.5 * Math.PI) / 180))).toBe("face");
    expect(classifyProjectionMode(Math.sin((0.5 * Math.PI) / 180))).toBe("edge");
  });

  it("classifies just outside each tolerance as oblique", () => {
    expect(classifyProjectionMode(Math.cos((2 * Math.PI) / 180))).toBe("oblique");
    expect(classifyProjectionMode(Math.sin((2 * Math.PI) / 180))).toBe("oblique");
  });

  it("classifies the middle range as oblique", () => {
    expect(classifyProjectionMode(0.5)).toBe("oblique");
  });

  it("treats non-finite alignment as oblique", () => {
    expect(classifyProjectionMode(Number.NaN)).toBe("oblique");
  });
});

describe("degenerate and non-finite input", () => {
  it("is invisible for an empty field of view", () => {
    const r = projectPrescription(makePrescription({ fovRead: 0 }), axial());
    expect(r.isVisible).toBe(false);
    expect(r.outline).toBeNull();
  });

  it("is invisible for a negative field of view", () => {
    expect(projectPrescription(makePrescription({ fovPhase: -10 }), axial()).isVisible).toBe(false);
  });

  it("is invisible for a non-finite centre, without producing NaN corners", () => {
    const r = projectPrescription(makePrescription({ center: { x: Number.NaN, y: 0, z: 0 } }), axial());
    expect(r.isVisible).toBe(false);
    expect(r.outline).toBeNull();
  });

  it("emits no slice outlines for an empty stack", () => {
    expect(projectPrescription(makePrescription({ sliceCount: 0 }), axial()).sliceOutlines).toHaveLength(0);
  });
});

describe("immutability", () => {
  it("freezes the result and its geometry", () => {
    const r = projectPrescription(makePrescription({ orientation: tilted(20) }), axial());
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.outline)).toBe(true);
    expect(Object.isFrozen(r.outline![0])).toBe(true);
    expect(Object.isFrozen(r.sliceOutlines)).toBe(true);
    expect(Object.isFrozen(r.normalStepPx)).toBe(true);
  });

  it("cannot be mutated by a consumer", () => {
    const r = projectPrescription(makePrescription(), axial());
    expect(() => {
      (r as { mode: string }).mode = "edge";
    }).toThrow();
    expect(() => (r.sliceOutlines as unknown as unknown[]).push([])).toThrow();
  });
});
