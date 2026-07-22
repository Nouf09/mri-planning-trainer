import { describe, it, expect } from "vitest";
import {
  readVolumeGeometry,
  type VolumeSpatialSource,
} from "@/features/imaging/adapters/niivue/read-volume-geometry";
import { boundsSize } from "@/features/imaging/domain/volume-geometry";

/** Canonical 1 mm isotropic brain, centred on the origin. */
function canonical(overrides: Partial<VolumeSpatialSource> = {}): VolumeSpatialSource {
  return {
    dimsRAS: [3, 180, 216, 180],
    pixDimsRAS: [1, 1, 1, 1],
    extentsMinOrtho: [-90, -108, -90],
    extentsMaxOrtho: [90, 108, 90],
    oblique_angle: 0,
    maxShearDeg: 0,
    ...overrides,
  };
}

describe("readVolumeGeometry — canonical volume", () => {
  it("reads dimensions and spacing from the RAS-ordered arrays", () => {
    const geometry = readVolumeGeometry(canonical())!;
    expect(geometry.dimensionsVox).toEqual({ x: 180, y: 216, z: 180 });
    expect(geometry.spacingMm).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("uses the orthogonal extents as bounds", () => {
    const geometry = readVolumeGeometry(canonical())!;
    expect(geometry.bounds.min).toEqual({ x: -90, y: -108, z: -90 });
    expect(geometry.bounds.max).toEqual({ x: 90, y: 108, z: 90 });
    expect(boundsSize(geometry.bounds)).toEqual({ x: 180, y: 216, z: 180 });
  });

  it("centres on the midpoint of the extents", () => {
    expect(readVolumeGeometry(canonical())!.center).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("labels the space it actually describes", () => {
    expect(readVolumeGeometry(canonical())!.coordinateSystem).toBe("niivue-ortho-mm");
  });

  it("agrees with the voxel count implied by size and spacing", () => {
    const geometry = readVolumeGeometry(canonical())!;
    const size = boundsSize(geometry.bounds);
    expect(size.x / geometry.spacingMm.x).toBeCloseTo(geometry.dimensionsVox.x, 9);
    expect(size.y / geometry.spacingMm.y).toBeCloseTo(geometry.dimensionsVox.y, 9);
    expect(size.z / geometry.spacingMm.z).toBeCloseTo(geometry.dimensionsVox.z, 9);
  });
});

describe("readVolumeGeometry — non-canonical volumes", () => {
  it("handles anisotropic spacing", () => {
    const geometry = readVolumeGeometry(
      canonical({
        pixDimsRAS: [1, 0.5, 0.5, 3],
        dimsRAS: [3, 360, 432, 60],
        extentsMinOrtho: [-90, -108, -90],
        extentsMaxOrtho: [90, 108, 90],
      })
    )!;
    expect(geometry.spacingMm).toEqual({ x: 0.5, y: 0.5, z: 3 });
    expect(geometry.dimensionsVox.z).toBe(60);
  });

  it("normalizes negative axis directions into ordered bounds", () => {
    const geometry = readVolumeGeometry(
      canonical({ extentsMinOrtho: [90, 108, 90], extentsMaxOrtho: [-90, -108, -90] })
    )!;
    expect(geometry.bounds.min).toEqual({ x: -90, y: -108, z: -90 });
    expect(geometry.bounds.max).toEqual({ x: 90, y: 108, z: 90 });
  });

  it("keeps sizes positive for a flipped left-right volume", () => {
    const geometry = readVolumeGeometry(
      canonical({ extentsMinOrtho: [90, -108, -90], extentsMaxOrtho: [-90, 108, 90] })
    )!;
    const size = boundsSize(geometry.bounds);
    expect(size.x).toBeGreaterThan(0);
    expect(size.y).toBeGreaterThan(0);
    expect(size.z).toBeGreaterThan(0);
  });

  it("treats negative spacing as a magnitude", () => {
    const geometry = readVolumeGeometry(canonical({ pixDimsRAS: [1, -1, 1, -2] }))!;
    expect(geometry.spacingMm).toEqual({ x: 1, y: 1, z: 2 });
  });

  it("carries obliquity through instead of discarding it", () => {
    const geometry = readVolumeGeometry(
      canonical({ oblique_angle: 12.5, maxShearDeg: 0.4 })
    )!;
    expect(geometry.obliquity).toEqual({ angleDeg: 12.5, maxShearDeg: 0.4 });
    // Bounds remain an axis-aligned box in this space; obliquity is not erased.
    expect(geometry.coordinateSystem).toBe("niivue-ortho-mm");
  });

  it("defaults obliquity to zero when the source omits it", () => {
    const geometry = readVolumeGeometry(
      canonical({ oblique_angle: undefined, maxShearDeg: undefined })
    )!;
    expect(geometry.obliquity).toEqual({ angleDeg: 0, maxShearDeg: 0 });
  });
});

describe("readVolumeGeometry — incomplete sources", () => {
  it("returns null with no source", () => {
    expect(readVolumeGeometry(null)).toBeNull();
    expect(readVolumeGeometry(undefined)).toBeNull();
  });

  it("returns null before dimensions are known", () => {
    expect(readVolumeGeometry(canonical({ dimsRAS: undefined }))).toBeNull();
  });

  it("returns null before spacing is known", () => {
    expect(readVolumeGeometry(canonical({ pixDimsRAS: undefined }))).toBeNull();
  });

  it("returns null before extents are known", () => {
    expect(readVolumeGeometry(canonical({ extentsMinOrtho: undefined }))).toBeNull();
    expect(readVolumeGeometry(canonical({ extentsMaxOrtho: undefined }))).toBeNull();
  });

  it("returns null for short arrays", () => {
    expect(readVolumeGeometry(canonical({ dimsRAS: [3, 180] }))).toBeNull();
    expect(readVolumeGeometry(canonical({ extentsMinOrtho: [0, 0] }))).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(readVolumeGeometry(canonical({ extentsMaxOrtho: [Number.NaN, 108, 90] }))).toBeNull();
    expect(readVolumeGeometry(canonical({ dimsRAS: [3, 180, Number.NaN, 180] }))).toBeNull();
  });
});
