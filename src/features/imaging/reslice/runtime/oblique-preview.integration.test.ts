import { describe, it, expect } from "vitest";
import { NVImage } from "@niivue/niivue";
import { AXIAL } from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import { buildVolumeSamplerCapability } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import { prescriptionToResliceRequest } from "@/features/imaging/reslice/prescription-to-reslice-request";
import { resliceVolume } from "@/features/imaging/reslice/reslice-volume";
import { buildObliquePreview } from "@/features/imaging/reslice/runtime/build-oblique-preview";
import {
  buildNiftiBuffer,
  decodeNativeCoordinate,
  encodeNativeCoordinate,
} from "@/features/imaging/adapters/niivue/testing/nifti-test-buffer";

/** 2 mm isotropic, origin (-10,-20,-30): voxel (x,y,z) world = (2x-10, 2y-20, 2z-30). */
async function loadCanonical() {
  const buffer = buildNiftiBuffer({
    dims: [3, 4, 5],
    srow: [[2, 0, 0, -10], [0, 2, 0, -20], [0, 0, 2, -30]],
    valueAt: encodeNativeCoordinate,
  });
  const factory = NVImage as unknown as { new: (...a: unknown[]) => Promise<never> };
  return factory.new(buffer, "canonical.nii", "gray", 1, null, NaN, NaN, false, 2, false, false, "", 0, 0 as unknown, NaN, NaN, false, null, 0, null);
}

const AXIAL_AT_VOXEL_1_1_2: Prescription = {
  center: { x: -8, y: -18, z: -26 }, // world position of voxel (1,1,2)
  orientation: AXIAL,
  fovRead: 4,
  fovPhase: 6,
  sliceThickness: 2,
  sliceGap: 0,
  sliceCount: 1,
};

describe("runtime capability over a real volume", () => {
  it("builds a ready capability with a valid window", async () => {
    const image = await loadCanonical();
    const capability = buildVolumeSamplerCapability("canonical", image);
    expect(capability).not.toBeNull();
    expect(capability!.intensityWindow.source).toBe("global");
    expect(capability!.createSampler().status).toBe("ready");
  });
});

describe("zero-tilt geometry is correct end to end", () => {
  /** Nearest reslice through the runtime mapper, as a 3x3 coordinate grid. */
  async function grid() {
    const image = await loadCanonical();
    const creation = buildVolumeSamplerCapability("canonical", image)!.createSampler();
    if (creation.status !== "ready") throw new Error(creation.status);
    const request = prescriptionToResliceRequest(AXIAL_AT_VOXEL_1_1_2, {
      volumeId: "canonical",
      outputWidthPx: 3,
      outputHeightPx: 3,
      interpolation: "nearest",
      outOfBounds: "transparent",
    });
    const outcome = resliceVolume(request, creation.sampler);
    if (outcome.status !== "ok") throw new Error(outcome.status);
    const at = (col: number, row: number) => decodeNativeCoordinate(outcome.slice.intensities[row * 3 + col]);
    return at;
  }

  it("samples the prescription centre at the plane centre", async () => {
    const at = await grid();
    expect(at(1, 1)).toEqual({ x: 1, y: 1, z: 2 });
  });

  it("maps columns to +read (left to right) without mirroring", async () => {
    const at = await grid();
    expect(at(0, 1).x).toBe(0);
    expect(at(2, 1).x).toBe(2);
  });

  it("maps row 0 to +phase (top of image), with no vertical flip", async () => {
    const at = await grid();
    expect(at(1, 0).y).toBeGreaterThan(at(1, 2).y);
    expect(at(1, 0).y).toBe(2);
    expect(at(1, 2).y).toBe(0);
  });

  it("keeps the whole centre plane on the same slice", async () => {
    const at = await grid();
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      expect(at(col, row).z).toBe(2);
    }
  });
});

describe("buildObliquePreview over a real volume", () => {
  it("produces a ready preview with FOV-proportioned dimensions", async () => {
    const image = await loadCanonical();
    const capability = buildVolumeSamplerCapability("canonical", image)!;
    const caps = { volumeIdentity: "canonical", geometry: capability.geometry, volumeSampler: capability };
    const prescription: Prescription = { ...AXIAL_AT_VOXEL_1_1_2, fovRead: 8, fovPhase: 4 };
    const state = buildObliquePreview({ prescription, capabilities: caps });
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.image.width).toBe(256);
    expect(state.image.height).toBe(128);
  });
});
