import { describe, it, expect } from "vitest";
import { NVImage } from "@niivue/niivue";
import { readVolumeGeometry } from "@/features/imaging/adapters/niivue/read-volume-geometry";
import {
  createNiivueVolumeSampler,
  type NiivueImageLike,
} from "@/features/imaging/adapters/niivue/niivue-volume-sampler";
import type { MutableVec3, VolumeSampler } from "@/features/imaging/reslice/volume-sampler";
import {
  buildNiftiBuffer,
  decodeNativeCoordinate,
  encodeNativeCoordinate,
  niftiVoxelToWorld,
  type NiftiSpec,
} from "@/features/imaging/adapters/niivue/testing/nifti-test-buffer";

/**
 * These tests build real NIfTI-1 buffers, load them through the installed
 * Niivue, and prove the adapter samples the correct anatomical voxel. Every
 * direction claim is asserted numerically: no test passes because an image
 * looks plausible.
 */

interface RealImage extends NiivueImageLike {
  dimsRAS?: number[];
  convertMM2Frac(mm: number[], isForceSliceMM?: boolean): ArrayLike<number>;
  getValue(x: number, y: number, z: number): number;
}

async function loadImage(buffer: ArrayBuffer): Promise<RealImage> {
  const factory = NVImage as unknown as { new: (...a: unknown[]) => Promise<RealImage> };
  return factory.new(
    buffer, "test.nii", "gray", 1, null, NaN, NaN, false, 2, false, false, "", 0, 0 as unknown, NaN, NaN, false, null, 0, null
  );
}

async function makeSampler(spec: NiftiSpec): Promise<{ image: RealImage; sampler: VolumeSampler }> {
  const image = await loadImage(buildNiftiBuffer(spec));
  const geometry = readVolumeGeometry(image as never);
  if (!geometry) throw new Error("geometry could not be read");
  const result = createNiivueVolumeSampler({ volumeId: "test", image, geometry });
  if (result.status !== "ready") throw new Error(`sampler not ready: ${result.status}`);
  return { image, sampler: result.sampler };
}

/** 2 mm isotropic, origin (-10,-20,-30), coordinate-encoded, asymmetric 3x4x5. */
const CANONICAL: NiftiSpec = {
  dims: [3, 4, 5],
  srow: [
    [2, 0, 0, -10],
    [0, 2, 0, -20],
    [0, 0, 2, -30],
  ],
  valueAt: encodeNativeCoordinate,
};

describe("adapter matches direct Niivue lookup", () => {
  it("returns exactly what getValue returns at every voxel", async () => {
    const { image, sampler } = await makeSampler(CANONICAL);
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 4; y++) {
        for (let z = 0; z < 5; z++) {
          expect(sampler.getVoxel(x, y, z)).toBe(image.getValue(x, y, z));
        }
      }
    }
  });

  it("matches convertMM2Frac * dims - 0.5 for world points", async () => {
    const { image, sampler } = await makeSampler(CANONICAL);
    const dims = image.dimsRAS!;
    const out: MutableVec3 = { x: 0, y: 0, z: 0 };
    // Niivue's convertMM2Frac uses gl-matrix Float32Array, so the reference is
    // only float32-accurate. The adapter (float64) agrees to well within that.
    const FLOAT32_TOLERANCE = 5;
    for (const mm of [[-6, -14, -24], [0, 0, 0], [-8, -18, -28]]) {
      sampler.worldToVoxel(mm[0], mm[1], mm[2], out);
      const frac = image.convertMM2Frac([mm[0], mm[1], mm[2]], false);
      expect(out.x).toBeCloseTo(frac[0] * dims[1] - 0.5, FLOAT32_TOLERANCE);
      expect(out.y).toBeCloseTo(frac[1] * dims[2] - 0.5, FLOAT32_TOLERANCE);
      expect(out.z).toBeCloseTo(frac[2] * dims[3] - 0.5, FLOAT32_TOLERANCE);
    }
  });
});

/** Rounds continuous voxel coordinates so a world point resolves to one voxel. */
function sampleWorld(sampler: VolumeSampler, x: number, y: number, z: number): number | null {
  const out: MutableVec3 = { x: 0, y: 0, z: 0 };
  if (!sampler.worldToVoxel(x, y, z, out)) return null;
  return sampler.getVoxel(Math.round(out.x), Math.round(out.y), Math.round(out.z));
}

describe("anatomical direction is correct", () => {
  it("maps +world-x to the expected right/left voxel", async () => {
    const { sampler } = await makeSampler(CANONICAL);
    // srow_x is +2, so increasing world x increases voxel x.
    const lowWorldX = niftiVoxelToWorld(CANONICAL, 0, 2, 2);
    const highWorldX = niftiVoxelToWorld(CANONICAL, 2, 2, 2);
    expect(decodeNativeCoordinate(sampleWorld(sampler, lowWorldX.x, lowWorldX.y, lowWorldX.z)!).x).toBe(0);
    expect(decodeNativeCoordinate(sampleWorld(sampler, highWorldX.x, highWorldX.y, highWorldX.z)!).x).toBe(2);
  });

  it("maps world-y (anterior/posterior) to the expected voxel", async () => {
    const { sampler } = await makeSampler(CANONICAL);
    const w = niftiVoxelToWorld(CANONICAL, 1, 3, 2);
    expect(decodeNativeCoordinate(sampleWorld(sampler, w.x, w.y, w.z)!).y).toBe(3);
  });

  it("maps world-z (superior/inferior) to the expected voxel", async () => {
    const { sampler } = await makeSampler(CANONICAL);
    const w = niftiVoxelToWorld(CANONICAL, 1, 2, 4);
    expect(decodeNativeCoordinate(sampleWorld(sampler, w.x, w.y, w.z)!).z).toBe(4);
  });

  it("round-trips every voxel through world and back", async () => {
    const { sampler } = await makeSampler(CANONICAL);
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 4; y++) {
        for (let z = 0; z < 5; z++) {
          const w = niftiVoxelToWorld(CANONICAL, x, y, z);
          expect(decodeNativeCoordinate(sampleWorld(sampler, w.x, w.y, w.z)!)).toEqual({ x, y, z });
        }
      }
    }
  });
});

describe("radiological (negative determinant) volume", () => {
  const RADIOLOGICAL: NiftiSpec = {
    dims: [3, 4, 5],
    srow: [
      [-2, 0, 0, 10], // +voxel-x now maps to -world-x
      [0, 2, 0, -20],
      [0, 0, 2, -30],
    ],
    valueAt: encodeNativeCoordinate,
  };

  it("does not mirror left and right", async () => {
    const { sampler } = await makeSampler(RADIOLOGICAL);
    // With srow_x negative, the largest world x is voxel 0, not voxel 2.
    const wVoxel0 = niftiVoxelToWorld(RADIOLOGICAL, 0, 2, 2);
    const wVoxel2 = niftiVoxelToWorld(RADIOLOGICAL, 2, 2, 2);
    expect(wVoxel0.x).toBeGreaterThan(wVoxel2.x);
    expect(decodeNativeCoordinate(sampleWorld(sampler, wVoxel0.x, wVoxel0.y, wVoxel0.z)!).x).toBe(0);
    expect(decodeNativeCoordinate(sampleWorld(sampler, wVoxel2.x, wVoxel2.y, wVoxel2.z)!).x).toBe(2);
  });
});

describe("anisotropic spacing", () => {
  const ANISOTROPIC: NiftiSpec = {
    dims: [3, 4, 5],
    srow: [
      [4, 0, 0, 0], // 4 mm along x
      [0, 1, 0, 0], // 1 mm along y
      [0, 0, 2, 0], // 2 mm along z
    ],
    valueAt: encodeNativeCoordinate,
  };

  it("samples the correct voxel despite unequal spacing", async () => {
    const { sampler } = await makeSampler(ANISOTROPIC);
    const w = niftiVoxelToWorld(ANISOTROPIC, 2, 3, 4);
    expect(decodeNativeCoordinate(sampleWorld(sampler, w.x, w.y, w.z)!)).toEqual({ x: 2, y: 3, z: 4 });
  });
});

describe("axis-permuted volume", () => {
  // Voxel x -> world y, voxel y -> world z, voxel z -> world x.
  const PERMUTED: NiftiSpec = {
    dims: [3, 4, 5],
    srow: [
      [0, 0, 2, -30], // world x from voxel z
      [2, 0, 0, -10], // world y from voxel x
      [0, 2, 0, -20], // world z from voxel y
    ],
    valueAt: encodeNativeCoordinate,
  };

  it("resolves permuted axes to the correct native voxel", async () => {
    const { image, sampler } = await makeSampler(PERMUTED);
    // permRAS should be non-identity here, exercising getValue's reordering.
    expect((image as unknown as { permRAS: number[] }).permRAS.join(",")).not.toBe("1,2,3");
    const w = niftiVoxelToWorld(PERMUTED, 2, 3, 4);
    expect(decodeNativeCoordinate(sampleWorld(sampler, w.x, w.y, w.z)!)).toEqual({ x: 2, y: 3, z: 4 });
  });
});

describe("intensity slope and intercept", () => {
  it("returns Niivue's scaled value and does not rescale it", async () => {
    const spec: NiftiSpec = {
      dims: [2, 2, 2],
      srow: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]],
      sclSlope: 3,
      sclInter: 100,
      valueAt: (x) => x, // stored 0 or 1 -> scaled 100 or 103
    };
    const { image, sampler } = await makeSampler(spec);
    expect(sampler.getVoxel(0, 0, 0)).toBe(image.getValue(0, 0, 0));
    expect(sampler.getVoxel(1, 0, 0)).toBe(image.getValue(1, 0, 0));
    // Scaling applied exactly once: value 1 -> 3*1 + 100 = 103, not 3*103+100.
    expect(sampler.getVoxel(1, 0, 0)).toBe(103);
  });
});

describe("bounds behaviour against a real volume", () => {
  it("returns null outside the volume rather than an edge voxel", async () => {
    const { sampler } = await makeSampler(CANONICAL);
    expect(sampler.getVoxel(-1, 0, 0)).toBeNull();
    expect(sampler.getVoxel(3, 0, 0)).toBeNull();
    expect(sampler.getVoxel(0, 0, 5)).toBeNull();
  });

  it("produces continuous fractional coordinates between voxels", async () => {
    const { sampler } = await makeSampler(CANONICAL);
    const out: MutableVec3 = { x: 0, y: 0, z: 0 };
    // Halfway between voxel centres 1 and 2 in world x.
    const a = niftiVoxelToWorld(CANONICAL, 1, 2, 2);
    const b = niftiVoxelToWorld(CANONICAL, 2, 2, 2);
    sampler.worldToVoxel((a.x + b.x) / 2, a.y, a.z, out);
    expect(out.x).toBeCloseTo(1.5, 6);
  });
});
