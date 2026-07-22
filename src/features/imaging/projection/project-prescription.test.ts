import { describe, it, expect } from "vitest";
import { boundsFromDescriptor } from "@/features/imaging/domain/volume-geometry";
import {
  AXIAL,
  CORONAL,
  SAGITTAL,
  orthonormalize,
  withInPlaneRotation,
} from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import { coverageMm } from "@/features/planning/domain/prescription-math";
import { createFittedCamera } from "@/features/imaging/projection/viewport-camera";
import { projectPrescription } from "@/features/imaging/projection/project-prescription";

const CUBE = boundsFromDescriptor({
  widthMm: 300,
  heightMm: 300,
  depthMm: 300,
  center: { x: 0, y: 0, z: 0 },
});
const VIEWPORT = { width: 600, height: 600 }; // 2 px per mm

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

const axialCamera = () => createFittedCamera(CUBE, AXIAL, VIEWPORT)!;
const coronalCamera = () => createFittedCamera(CUBE, CORONAL, VIEWPORT)!;
const sagittalCamera = () => createFittedCamera(CUBE, SAGITTAL, VIEWPORT)!;

describe("face projection", () => {
  it("reports face mode with a rectangle and no slab", () => {
    const result = projectPrescription(makePrescription(), axialCamera());
    expect(result.mode).toBe("face");
    expect(result.rectangle).not.toBeNull();
    expect(result.slab).toBeNull();
    expect(result.isVisible).toBe(true);
  });

  it("scales the field of view into pixels", () => {
    const result = projectPrescription(makePrescription(), axialCamera());
    expect(result.rectangle!.widthPx).toBeCloseTo(400, 9);
    expect(result.rectangle!.heightPx).toBeCloseTo(200, 9);
  });

  it("shows no slice boundaries in the slice plane", () => {
    expect(projectPrescription(makePrescription(), axialCamera()).sliceLines).toHaveLength(0);
  });

  it("centres a centred prescription in the viewport", () => {
    const result = projectPrescription(makePrescription(), axialCamera());
    expect(result.rectangle!.center).toEqual({ x: 300, y: 300 });
  });
});

describe("edge projection", () => {
  it("reports edge mode with a slab and no rectangle", () => {
    const result = projectPrescription(makePrescription(), coronalCamera());
    expect(result.mode).toBe("edge");
    expect(result.slab).not.toBeNull();
    expect(result.rectangle).toBeNull();
  });

  it("shows the slab depth in pixels", () => {
    const prescription = makePrescription();
    const result = projectPrescription(prescription, coronalCamera());
    expect(result.slab!.heightPx).toBeCloseTo(coverageMm(prescription) * 2, 9);
    expect(result.slab!.thicknessPx).toBeCloseTo(coverageMm(prescription) * 2, 9);
  });

  it("draws one boundary per slice", () => {
    const result = projectPrescription(makePrescription({ sliceCount: 6 }), coronalCamera());
    expect(result.sliceLines).toHaveLength(6);
  });

  it("spaces boundaries by the slice pitch in pixels", () => {
    const result = projectPrescription(makePrescription(), coronalCamera());
    const positions = result.sliceLines.map((line) => line.start.y);
    expect(Math.abs(positions[1] - positions[0])).toBeCloseTo(12, 9);
  });

  it("uses the phase field of view horizontally in sagittal", () => {
    const result = projectPrescription(makePrescription(), sagittalCamera());
    expect(result.slab!.widthPx).toBeCloseTo(200, 9);
  });
});

describe("anatomical position in pixels", () => {
  it("moves the projection when the prescription moves", () => {
    const moved = makePrescription({ center: { x: 50, y: 0, z: 0 } });
    const result = projectPrescription(moved, axialCamera());
    expect(result.rectangle!.center.x).toBeCloseTo(400, 9);
    expect(result.rectangle!.center.y).toBeCloseTo(300, 9);
  });

  it("inverts the vertical axis for screen coordinates", () => {
    const moved = makePrescription({ center: { x: 0, y: 50, z: 0 } });
    const result = projectPrescription(moved, axialCamera());
    expect(result.rectangle!.center.y).toBeCloseTo(200, 9);
  });

  it("reports out-of-plane offset without moving the projection", () => {
    const moved = makePrescription({ center: { x: 0, y: 0, z: 25 } });
    const result = projectPrescription(moved, axialCamera());
    expect(result.rectangle!.center).toEqual({ x: 300, y: 300 });
    expect(result.outOfPlaneOffsetMm).toBeCloseTo(25, 9);
  });

  it("carries the centre into slice boundary positions", () => {
    const moved = makePrescription({ center: { x: 40, y: 0, z: 0 } });
    const result = projectPrescription(moved, coronalCamera());
    for (const line of result.sliceLines) {
      expect((line.start.x + line.end.x) / 2).toBeCloseTo(380, 9);
    }
  });
});

describe("rotation sign in screen coordinates", () => {
  it("reverses in-plane rotation, because screen y points down", () => {
    const rotated = makePrescription({ orientation: withInPlaneRotation(AXIAL, 30)! });
    const result = projectPrescription(rotated, axialCamera());
    expect(result.rectangle!.rotationRad).toBeCloseTo((-30 * Math.PI) / 180, 9);
  });

  it("leaves an unrotated prescription unrotated", () => {
    expect(projectPrescription(makePrescription(), axialCamera()).rectangle!.rotationRad).toBe(-0);
  });

  it("does not rotate an edge-on slab", () => {
    const rotated = makePrescription({ orientation: withInPlaneRotation(AXIAL, 30)! });
    expect(projectPrescription(rotated, coronalCamera()).slab!.rotationRad).toBe(-0);
  });
});

describe("degenerate and non-finite input", () => {
  it("is invisible for an empty field of view", () => {
    const result = projectPrescription(makePrescription({ fovRead: 0 }), axialCamera());
    expect(result.isVisible).toBe(false);
    expect(result.rectangle).toBeNull();
    expect(result.slab).toBeNull();
  });

  it("is invisible for a negative field of view", () => {
    expect(projectPrescription(makePrescription({ fovPhase: -10 }), axialCamera()).isVisible).toBe(
      false
    );
  });

  it("is invisible for non-finite geometry", () => {
    const broken = makePrescription({ center: { x: Number.NaN, y: 0, z: 0 } });
    expect(projectPrescription(broken, axialCamera()).isVisible).toBe(false);
  });

  it("has no slab depth when the stack is empty", () => {
    const result = projectPrescription(makePrescription({ sliceCount: 0 }), coronalCamera());
    expect(result.isVisible).toBe(false);
  });
});

describe("camera independence", () => {
  it("projects against an arbitrary basis with no plane-name branching", () => {
    const tilted = orthonormalize({ x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 })!;
    const camera = createFittedCamera(CUBE, tilted, VIEWPORT)!;
    const result = projectPrescription(makePrescription(), camera);
    expect(result.isVisible).toBe(true);
    expect(["face", "edge"]).toContain(result.mode);
  });

  it("stays numerically stable for a large prescription", () => {
    const huge = makePrescription({ fovRead: 1e4, fovPhase: 1e4 });
    const result = projectPrescription(huge, axialCamera());
    expect(Number.isFinite(result.rectangle!.widthPx)).toBe(true);
    expect(Number.isFinite(result.rectangle!.center.x)).toBe(true);
  });
});

describe("immutability", () => {
  it("freezes the result and its parts", () => {
    const result = projectPrescription(makePrescription(), coronalCamera());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.slab)).toBe(true);
    expect(Object.isFrozen(result.slab!.center)).toBe(true);
    expect(Object.isFrozen(result.sliceLines)).toBe(true);
    expect(Object.isFrozen(result.sliceLines[0])).toBe(true);
  });

  it("cannot be mutated by a consumer", () => {
    const result = projectPrescription(makePrescription(), axialCamera());
    const mutate = () => {
      (result as { mode: string }).mode = "oblique";
    };
    expect(mutate).toThrow();
    expect(result.mode).toBe("face");
  });

  it("rejects appending to the slice line list", () => {
    const result = projectPrescription(makePrescription(), coronalCamera());
    expect(() => (result.sliceLines as unknown as unknown[]).push({})).toThrow();
  });
});
