import { describe, it, expect, vi } from "vitest";
import { AXIAL } from "@/features/planning/domain/orientation";
import { sliceOffsetsMm } from "@/features/planning/domain/prescription-math";
import type { Prescription } from "@/features/planning/domain/prescription";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import type { NiivueSamplerCreationResult } from "@/features/imaging/adapters/niivue/niivue-volume-sampler";
import type { VolumeSampler } from "@/features/imaging/reslice/volume-sampler";
import {
  buildStackDescriptor,
  centreSliceIndex,
  renderStackSlice,
} from "@/features/imaging/reslice/runtime/build-oblique-stack";

const GEOMETRY: VolumeGeometry = {
  dimensionsVox: { x: 20, y: 20, z: 20 },
  spacingMm: { x: 1, y: 1, z: 1 },
  bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } },
  center: { x: 0, y: 0, z: 0 },
  obliquity: { angleDeg: 0, maxShearDeg: 0 },
  coordinateSystem: "niivue-ortho-mm",
};

const sampler: VolumeSampler = {
  volumeId: "vol", dimensions: [20, 20, 20],
  worldToVoxel: (x, y, z, out) => { out.x = x + 10; out.y = y + 10; out.z = z + 10; return true; },
  getVoxel: (x, y, z) => (x < 0 || y < 0 || z < 0 || x > 19 || y > 19 || z > 19 ? null : x + y * 20 + z * 400),
};

function makePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return { center: { x: 0, y: 0, z: 0 }, orientation: AXIAL, fovRead: 10, fovPhase: 10, sliceThickness: 3, sliceGap: 1, sliceCount: 5, ...overrides };
}

function makeCapabilities(creation: NiivueSamplerCreationResult = { status: "ready", sampler }): ImagingRuntimeCapabilities {
  return {
    volumeIdentity: "vol", geometry: GEOMETRY,
    volumeSampler: { volumeIdentity: "vol", geometry: GEOMETRY, intensityWindow: { min: 0, max: 8000, source: "cal" }, createSampler: () => creation },
  };
}

const readyDescriptor = (p = makePrescription(), caps = makeCapabilities()) => {
  const r = buildStackDescriptor(p, caps);
  if (r.status !== "ready") throw new Error(r.status);
  return r.descriptor;
};

describe("stack positions reuse sliceOffsetsMm", () => {
  it("uses sliceOffsetsMm exactly as its positions", () => {
    const p = makePrescription({ sliceCount: 7, sliceThickness: 4, sliceGap: 2 });
    expect(readyDescriptor(p).offsetsMm).toEqual(sliceOffsetsMm(p));
  });

  it("orders offsets ascending and symmetric about zero", () => {
    const offsets = readyDescriptor(makePrescription({ sliceCount: 5 })).offsetsMm;
    for (let i = 1; i < offsets.length; i++) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    expect(offsets[0]).toBeCloseTo(-offsets[offsets.length - 1], 9);
  });

  it("spaces slices by thickness plus gap", () => {
    const offsets = readyDescriptor(makePrescription({ sliceThickness: 3, sliceGap: 1 })).offsetsMm;
    expect(offsets[1] - offsets[0]).toBeCloseTo(4, 9);
  });

  it("produces exactly offset 0 for a single slice", () => {
    expect(readyDescriptor(makePrescription({ sliceCount: 1 })).offsetsMm).toEqual([0]);
  });

  it("centres an odd count on zero, and centres an even count symmetrically", () => {
    expect(readyDescriptor(makePrescription({ sliceCount: 3 })).offsetsMm[1]).toBeCloseTo(0, 9);
    const even = readyDescriptor(makePrescription({ sliceCount: 4 })).offsetsMm;
    expect(even[0]).toBeCloseTo(-even[3], 9);
  });

  it("matches first and last offsets to sliceOffsetsMm", () => {
    const p = makePrescription({ sliceCount: 6 });
    const expected = sliceOffsetsMm(p);
    const offsets = readyDescriptor(p).offsetsMm;
    expect(offsets[0]).toBe(expected[0]);
    expect(offsets.at(-1)).toBe(expected.at(-1));
  });
});

describe("centreSliceIndex", () => {
  it("uses floor(count / 2)", () => {
    expect(centreSliceIndex(1)).toBe(0);
    expect(centreSliceIndex(5)).toBe(2);
    expect(centreSliceIndex(30)).toBe(15);
  });
});

describe("descriptor identity and gates", () => {
  it("changes identity when the prescription geometry changes", () => {
    const a = readyDescriptor(makePrescription({ sliceCount: 5 }));
    const b = readyDescriptor(makePrescription({ sliceCount: 6 }));
    expect(a.identity).not.toBe(b.identity);
  });

  it("changes identity when the field of view changes", () => {
    const a = readyDescriptor(makePrescription({ fovRead: 10 }));
    const b = readyDescriptor(makePrescription({ fovRead: 20 }));
    expect(a.identity).not.toBe(b.identity);
  });

  it("is stable for equal inputs", () => {
    expect(readyDescriptor().identity).toBe(readyDescriptor().identity);
  });

  it("refuses an oblique source without pixels", () => {
    const caps = makeCapabilities({ status: "unsupported", reason: "source-volume-obliquity", measuredAngleDeg: 5, maximumSupportedAngleDeg: 1 });
    expect(buildStackDescriptor(makePrescription(), caps)).toMatchObject({ status: "unsupported" });
  });

  it("is invalid when the volume has no sampler capability", () => {
    const caps: ImagingRuntimeCapabilities = { volumeIdentity: "vol", geometry: GEOMETRY, volumeSampler: null };
    expect(buildStackDescriptor(makePrescription(), caps).status).toBe("invalid");
  });

  it("creates the sampler once per descriptor build", () => {
    const createSampler = vi.fn(() => ({ status: "ready" as const, sampler }));
    const caps: ImagingRuntimeCapabilities = { volumeIdentity: "vol", geometry: GEOMETRY, volumeSampler: { volumeIdentity: "vol", geometry: GEOMETRY, intensityWindow: { min: 0, max: 8000, source: "cal" }, createSampler } };
    buildStackDescriptor(makePrescription(), caps);
    expect(createSampler).toHaveBeenCalledTimes(1);
  });
});

describe("renderStackSlice", () => {
  it("renders a slice image at a valid index", () => {
    const result = renderStackSlice(readyDescriptor(), 0);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.image.gray.length).toBe(result.image.width * result.image.height);
  });

  it("positions different indices at different offsets along the normal", () => {
    const descriptor = readyDescriptor(makePrescription({ sliceCount: 5 }));
    const first = renderStackSlice(descriptor, 0);
    const last = renderStackSlice(descriptor, 4);
    if (first.status !== "ready" || last.status !== "ready") throw new Error("not ready");
    // The two extreme slices sample different anatomy.
    expect(Array.from(first.image.gray)).not.toEqual(Array.from(last.image.gray));
  });

  it("errors for an out-of-range index", () => {
    expect(renderStackSlice(readyDescriptor(), -1).status).toBe("error");
    expect(renderStackSlice(readyDescriptor(makePrescription({ sliceCount: 3 })), 3).status).toBe("error");
  });
});
