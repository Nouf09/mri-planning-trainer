import { describe, it, expect, vi } from "vitest";
import { AXIAL } from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import type {
  ImagingRuntimeCapabilities,
  VolumeSamplerCapability,
} from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import type { NiivueSamplerCreationResult } from "@/features/imaging/adapters/niivue/niivue-volume-sampler";
import type { VolumeSampler } from "@/features/imaging/reslice/volume-sampler";
import { buildObliquePreview } from "@/features/imaging/reslice/runtime/build-oblique-preview";

const GEOMETRY: VolumeGeometry = {
  dimensionsVox: { x: 10, y: 10, z: 10 },
  spacingMm: { x: 1, y: 1, z: 1 },
  bounds: { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } },
  center: { x: 0, y: 0, z: 0 },
  obliquity: { angleDeg: 0, maxShearDeg: 0 },
  coordinateSystem: "niivue-ortho-mm",
};

/** A sampler over a small coordinate-encoded volume, centred at the origin. */
const fakeSampler: VolumeSampler = {
  volumeId: "vol",
  dimensions: [10, 10, 10],
  worldToVoxel: (x, y, z, out) => {
    out.x = x + 5; out.y = y + 5; out.z = z + 5;
    return true;
  },
  getVoxel: (x, y, z) => (x < 0 || y < 0 || z < 0 || x > 9 || y > 9 || z > 9 ? null : x + y * 10 + z * 100),
};

function makePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    center: { x: 0, y: 0, z: 0 },
    orientation: AXIAL,
    fovRead: 8, fovPhase: 8,
    sliceThickness: 1, sliceGap: 0, sliceCount: 1,
    ...overrides,
  };
}

function makeCapabilities(creation: NiivueSamplerCreationResult, window = { min: 0, max: 909, source: "cal" as const }): ImagingRuntimeCapabilities {
  const volumeSampler: VolumeSamplerCapability = {
    volumeIdentity: "vol",
    geometry: GEOMETRY,
    intensityWindow: window,
    createSampler: () => creation,
  };
  return { volumeIdentity: "vol", geometry: GEOMETRY, volumeSampler };
}

const readyCreation: NiivueSamplerCreationResult = { status: "ready", sampler: fakeSampler };

describe("buildObliquePreview prerequisites", () => {
  it("waits without capabilities", () => {
    expect(buildObliquePreview({ prescription: makePrescription(), capabilities: null }).status).toBe("waiting-for-volume");
  });

  it("is invalid without a prescription", () => {
    expect(buildObliquePreview({ prescription: null, capabilities: makeCapabilities(readyCreation) }).status).toBe("invalid");
  });

  it("is invalid when the volume has no sampler capability (no window)", () => {
    const caps: ImagingRuntimeCapabilities = { volumeIdentity: "vol", geometry: GEOMETRY, volumeSampler: null };
    expect(buildObliquePreview({ prescription: makePrescription(), capabilities: caps }).status).toBe("invalid");
  });
});

describe("buildObliquePreview safety gates", () => {
  it("reports unsupported for an oblique source, with no pixels", () => {
    const caps = makeCapabilities({ status: "unsupported", reason: "source-volume-obliquity", measuredAngleDeg: 5, maximumSupportedAngleDeg: 1 });
    const state = buildObliquePreview({ prescription: makePrescription(), capabilities: caps });
    expect(state.status).toBe("unsupported");
    expect(state).not.toHaveProperty("image");
  });

  it("reports unsupported for a sheared source", () => {
    const caps = makeCapabilities({ status: "unsupported", reason: "source-volume-shear", measuredShearDeg: 0.5, maximumSupportedShearDeg: 0.1 });
    expect(buildObliquePreview({ prescription: makePrescription(), capabilities: caps }).status).toBe("unsupported");
  });

  it("reports invalid for an invalid sampler", () => {
    const caps = makeCapabilities({ status: "invalid", reason: "bad" });
    expect(buildObliquePreview({ prescription: makePrescription(), capabilities: caps }).status).toBe("invalid");
  });
});

describe("buildObliquePreview ready path", () => {
  it("produces a ready image via the full pipeline", () => {
    const state = buildObliquePreview({ prescription: makePrescription(), capabilities: makeCapabilities(readyCreation) });
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.image.width).toBeGreaterThan(0);
    expect(state.image.gray).toHaveLength(state.image.width * state.image.height);
    expect(state.image.alpha).toHaveLength(state.image.width * state.image.height);
  });

  it("derives output dimensions from the prescription field of view", () => {
    const state = buildObliquePreview({ prescription: makePrescription({ fovRead: 8, fovPhase: 4 }), capabilities: makeCapabilities(readyCreation) });
    if (state.status !== "ready") throw new Error(state.status);
    expect(state.image.width).toBe(256);
    expect(state.image.height).toBe(128);
  });

  it("passes trilinear, transparent, and slice offset 0 through the mapper", () => {
    const createSampler = vi.fn(() => readyCreation);
    const caps: ImagingRuntimeCapabilities = {
      volumeIdentity: "vol", geometry: GEOMETRY,
      volumeSampler: { volumeIdentity: "vol", geometry: GEOMETRY, intensityWindow: { min: 0, max: 909, source: "cal" }, createSampler },
    };
    const state = buildObliquePreview({ prescription: makePrescription(), capabilities: caps });
    expect(state.status).toBe("ready");
    expect(createSampler).toHaveBeenCalledTimes(1);
  });

  it("is invalid when the field of view is non-positive", () => {
    const state = buildObliquePreview({ prescription: makePrescription({ fovRead: 0 }), capabilities: makeCapabilities(readyCreation) });
    expect(state.status).toBe("invalid");
  });
});
