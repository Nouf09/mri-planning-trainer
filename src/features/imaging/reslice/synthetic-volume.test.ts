import { describe, it, expect } from "vitest";
import {
  MARKER_VALUE,
  createCoordinateVolume,
  createGradientVolume,
  decodeCoordinate,
  encodeCoordinate,
  gradientValueAt,
  voxelToWorld,
} from "@/features/imaging/reslice/testing/synthetic-volume";

describe("coordinate encoding", () => {
  it("round-trips every axis", () => {
    for (const [x, y, z] of [[0, 0, 0], [4, 6, 2], [1, 0, 2]]) {
      expect(decodeCoordinate(encodeCoordinate(x, y, z))).toEqual({ x, y, z });
    }
  });

  it("distinguishes axis swaps", () => {
    expect(encodeCoordinate(1, 2, 3)).not.toBe(encodeCoordinate(3, 2, 1));
  });
});

describe("coordinate volume", () => {
  const volume = createCoordinateVolume();

  it("uses asymmetric dimensions so a transpose is detectable", () => {
    expect(volume.dimensions).toEqual([5, 7, 3]);
    expect(new Set(volume.dimensions).size).toBe(3);
  });

  it("returns the encoded index at each voxel", () => {
    expect(volume.getVoxel(4, 6, 2)).toBe(encodeCoordinate(4, 6, 2));
  });

  it("returns null outside the volume", () => {
    expect(volume.getVoxel(-1, 0, 0)).toBeNull();
    expect(volume.getVoxel(5, 0, 0)).toBeNull();
    expect(volume.getVoxel(0, 7, 0)).toBeNull();
    expect(volume.getVoxel(0, 0, 3)).toBeNull();
  });

  it("carries an asymmetric marker when asked", () => {
    const marked = createCoordinateVolume({ markerAt: [0, 0, 0] });
    expect(marked.getVoxel(0, 0, 0)).toBe(MARKER_VALUE);
    expect(marked.getVoxel(1, 0, 0)).toBe(encodeCoordinate(1, 0, 0));
  });
});

describe("world to voxel transforms", () => {
  const out = { x: 0, y: 0, z: 0 };

  it("maps the origin voxel to the origin world point", () => {
    const volume = createCoordinateVolume({ origin: [10, 20, 30] });
    expect(volume.worldToVoxel(10, 20, 30, out)).toBe(true);
    expect(out).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("honours anisotropic spacing", () => {
    const options = { spacing: [2, 0.5, 4] as const };
    const volume = createCoordinateVolume(options);
    volume.worldToVoxel(4, 1.5, 8, out);
    expect(out).toEqual({ x: 2, y: 3, z: 2 });
  });

  it("honours a translated transform", () => {
    const volume = createCoordinateVolume({ origin: [-50, -60, -70] });
    volume.worldToVoxel(-48, -60, -70, out);
    expect(out.x).toBeCloseTo(2, 9);
  });

  it("honours a mirrored axis", () => {
    const volume = createCoordinateVolume({ axisSign: [-1, 1, 1] });
    volume.worldToVoxel(-3, 0, 0, out);
    expect(out.x).toBeCloseTo(3, 9);
  });

  it("rejects non-finite world points", () => {
    expect(createCoordinateVolume().worldToVoxel(Number.NaN, 0, 0, out)).toBe(false);
  });

  it("agrees with voxelToWorld", () => {
    const options = { spacing: [2, 3, 4] as const, origin: [5, 6, 7] as const };
    const world = voxelToWorld(options, 1, 2, 0);
    const volume = createCoordinateVolume(options);
    volume.worldToVoxel(world.x, world.y, world.z, out);
    expect(out).toEqual({ x: 1, y: 2, z: 0 });
  });
});

describe("gradient volume", () => {
  it("is linear in voxel coordinates", () => {
    const options = { a: 1, b: 10, c: 100, d: 5 };
    const volume = createGradientVolume(options);
    expect(volume.getVoxel(1, 2, 0)).toBe(gradientValueAt(options, 1, 2, 0));
  });

  it("returns null outside the volume", () => {
    expect(createGradientVolume().getVoxel(99, 0, 0)).toBeNull();
  });
});
