import { describe, it, expect } from "vitest";
import { NVImage } from "@niivue/niivue";
import { AXIAL } from "@/features/planning/domain/orientation";
import { sliceOffsetsMm } from "@/features/planning/domain/prescription-math";
import type { Prescription } from "@/features/planning/domain/prescription";
import { buildVolumeSamplerCapability, type ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import { buildStackDescriptor, centreSliceIndex, renderStackSlice } from "@/features/imaging/reslice/runtime/build-oblique-stack";
import { buildObliquePreview } from "@/features/imaging/reslice/runtime/build-oblique-preview";
import { buildNiftiBuffer, encodeNativeCoordinate } from "@/features/imaging/adapters/niivue/testing/nifti-test-buffer";

/** 2 mm isotropic 16^3, origin -16: voxel (x,y,z) world = (2x-16, 2y-16, 2z-16). */
async function loadVolume() {
  const buffer = buildNiftiBuffer({ dims: [16, 16, 16], srow: [[2, 0, 0, -16], [0, 2, 0, -16], [0, 0, 2, -16]], valueAt: encodeNativeCoordinate });
  const factory = NVImage as unknown as { new: (...a: unknown[]) => Promise<never> };
  return factory.new(buffer, "vol.nii", "gray", 1, null, NaN, NaN, false, 2, false, false, "", 0, 0 as unknown, NaN, NaN, false, null, 0, null);
}

async function caps(): Promise<ImagingRuntimeCapabilities> {
  const image = await loadVolume();
  const capability = buildVolumeSamplerCapability("vol", image)!;
  return { volumeIdentity: "vol", geometry: capability.geometry, volumeSampler: capability };
}

/** Odd count so the centre index sits exactly at offset 0, matching Phase 10C. */
const ODD_STACK: Prescription = { center: { x: 0, y: 0, z: 0 }, orientation: AXIAL, fovRead: 20, fovPhase: 20, sliceThickness: 3, sliceGap: 1, sliceCount: 5 };

describe("stack descriptor over a real volume", () => {
  it("uses sliceOffsetsMm and reports the right count", async () => {
    const result = buildStackDescriptor(ODD_STACK, await caps());
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.descriptor.offsetsMm).toEqual(sliceOffsetsMm(ODD_STACK));
    expect(result.descriptor.offsetsMm).toHaveLength(5);
  });

  it("samples successive slices at increasing depth", async () => {
    const result = buildStackDescriptor(ODD_STACK, await caps());
    if (result.status !== "ready") throw new Error(result.status);
    const images = [0, 1, 2, 3, 4].map((i) => renderStackSlice(result.descriptor, i));
    for (const img of images) expect(img.status).toBe("ready");
    // Adjacent slices differ (different z planes of the coordinate-encoded volume).
    for (let i = 1; i < images.length; i++) {
      const a = images[i - 1], b = images[i];
      if (a.status !== "ready" || b.status !== "ready") throw new Error("not ready");
      expect(Array.from(a.image.gray)).not.toEqual(Array.from(b.image.gray));
    }
  });
});

describe("Phase 10C centre-slice regression", () => {
  it("reproduces the Phase 10C centre slice numerically at offset 0", async () => {
    const capabilities = await caps();
    // Phase 10C single-slice reference (always offset 0).
    const reference = buildObliquePreview({ prescription: ODD_STACK, capabilities });
    // Phase 10D stack, centre index of an odd stack == offset 0.
    const stack = buildStackDescriptor(ODD_STACK, capabilities);
    if (reference.status !== "ready" || stack.status !== "ready") throw new Error("not ready");
    const centre = renderStackSlice(stack.descriptor, centreSliceIndex(stack.descriptor.offsetsMm.length));
    if (centre.status !== "ready") throw new Error(centre.status);

    expect(stack.descriptor.offsetsMm[centreSliceIndex(5)]).toBeCloseTo(0, 9);
    expect(centre.image.width).toBe(reference.image.width);
    expect(centre.image.height).toBe(reference.image.height);
    expect(Array.from(centre.image.gray)).toEqual(Array.from(reference.image.gray));
    expect(Array.from(centre.image.alpha)).toEqual(Array.from(reference.image.alpha));
  });
});
