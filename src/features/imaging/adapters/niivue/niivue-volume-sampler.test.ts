import { describe, it, expect, vi } from "vitest";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import type { MutableVec3 } from "@/features/imaging/reslice/volume-sampler";
import {
  MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG,
  MAX_SUPPORTED_SOURCE_SHEAR_DEG,
  createNiivueVolumeSampler,
  type NiivueImageLike,
  type NiivueSamplerInput,
} from "@/features/imaging/adapters/niivue/niivue-volume-sampler";

/** Column-major identity, so fractional coordinates equal the input millimetres. */
const IDENTITY_MAT4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function makeImage(overrides: Partial<NiivueImageLike> = {}): NiivueImageLike {
  return {
    frac2mmOrtho: IDENTITY_MAT4,
    getValue: (x, y, z) => x * 10000 + y * 100 + z,
    ...overrides,
  };
}

function makeGeometry(overrides: Partial<VolumeGeometry> = {}): VolumeGeometry {
  return {
    dimensionsVox: { x: 4, y: 4, z: 4 },
    spacingMm: { x: 1, y: 1, z: 1 },
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } },
    center: { x: 2, y: 2, z: 2 },
    obliquity: { angleDeg: 0, maxShearDeg: 0 },
    coordinateSystem: "niivue-ortho-mm",
    ...overrides,
  };
}

function makeInput(overrides: Partial<NiivueSamplerInput> = {}): NiivueSamplerInput {
  return { volumeId: "vol", image: makeImage(), geometry: makeGeometry(), ...overrides };
}

function readySampler(input: NiivueSamplerInput = makeInput()) {
  const result = createNiivueVolumeSampler(input);
  if (result.status !== "ready") throw new Error(`expected ready, got ${result.status}`);
  return result.sampler;
}

describe("named safety constants", () => {
  it("uses the approved independent thresholds", () => {
    expect(MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG).toBe(1.0);
    expect(MAX_SUPPORTED_SOURCE_SHEAR_DEG).toBe(0.1);
  });
});

describe("creation input validation", () => {
  it("rejects an empty volume id", () => {
    const result = createNiivueVolumeSampler(makeInput({ volumeId: "" }));
    expect(result).toMatchObject({ status: "invalid" });
  });

  it("rejects non-positive or fractional dimensions", () => {
    for (const dimensionsVox of [{ x: 0, y: 4, z: 4 }, { x: 4, y: -1, z: 4 }, { x: 4, y: 4, z: 2.5 }]) {
      const result = createNiivueVolumeSampler(makeInput({ geometry: makeGeometry({ dimensionsVox }) }));
      expect(result.status).toBe("invalid");
    }
  });

  it("rejects an image without getValue", () => {
    const image = { frac2mmOrtho: IDENTITY_MAT4 } as unknown as NiivueImageLike;
    expect(createNiivueVolumeSampler(makeInput({ image })).status).toBe("invalid");
  });

  it("rejects a missing or short affine", () => {
    expect(createNiivueVolumeSampler(makeInput({ image: makeImage({ frac2mmOrtho: undefined }) })).status).toBe("invalid");
    expect(createNiivueVolumeSampler(makeInput({ image: makeImage({ frac2mmOrtho: [1, 2, 3] }) })).status).toBe("invalid");
  });

  it("rejects a non-finite affine", () => {
    const broken = [...IDENTITY_MAT4];
    broken[0] = Number.NaN;
    expect(createNiivueVolumeSampler(makeInput({ image: makeImage({ frac2mmOrtho: broken }) })).status).toBe("invalid");
  });

  it("rejects a singular affine", () => {
    const singular = new Array(16).fill(0);
    expect(createNiivueVolumeSampler(makeInput({ image: makeImage({ frac2mmOrtho: singular }) })).status).toBe("invalid");
  });

  it("rejects non-finite obliquity measurements", () => {
    const obliquity = { angleDeg: Number.NaN, maxShearDeg: 0 };
    expect(createNiivueVolumeSampler(makeInput({ geometry: makeGeometry({ obliquity }) })).status).toBe("invalid");
    const shear = { angleDeg: 0, maxShearDeg: Infinity };
    expect(createNiivueVolumeSampler(makeInput({ geometry: makeGeometry({ obliquity: shear }) })).status).toBe("invalid");
  });
});

describe("source obliquity gate", () => {
  const withAngle = (angleDeg: number) =>
    createNiivueVolumeSampler(makeInput({ geometry: makeGeometry({ obliquity: { angleDeg, maxShearDeg: 0 } }) }));

  it("accepts a volume exactly at the threshold", () => {
    expect(withAngle(MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG).status).toBe("ready");
  });

  it("accepts a volume just below the threshold", () => {
    expect(withAngle(0.999).status).toBe("ready");
  });

  it("refuses a volume just above the threshold", () => {
    const result = withAngle(1.001);
    expect(result).toEqual({
      status: "unsupported",
      reason: "source-volume-obliquity",
      measuredAngleDeg: 1.001,
      maximumSupportedAngleDeg: MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG,
    });
  });
});

describe("source shear gate", () => {
  const withShear = (maxShearDeg: number) =>
    createNiivueVolumeSampler(makeInput({ geometry: makeGeometry({ obliquity: { angleDeg: 0, maxShearDeg } }) }));

  it("accepts a volume exactly at the threshold", () => {
    expect(withShear(MAX_SUPPORTED_SOURCE_SHEAR_DEG).status).toBe("ready");
  });

  it("accepts a volume just below the threshold", () => {
    expect(withShear(0.099).status).toBe("ready");
  });

  it("refuses a volume just above the threshold", () => {
    const result = withShear(0.101);
    expect(result).toEqual({
      status: "unsupported",
      reason: "source-volume-shear",
      measuredShearDeg: 0.101,
      maximumSupportedShearDeg: MAX_SUPPORTED_SOURCE_SHEAR_DEG,
    });
  });
});

describe("gates are independent", () => {
  const create = (angleDeg: number, maxShearDeg: number) =>
    createNiivueVolumeSampler(makeInput({ geometry: makeGeometry({ obliquity: { angleDeg, maxShearDeg } }) }));

  it("refuses on shear even when obliquity is acceptable", () => {
    expect(create(0.5, 0.5)).toMatchObject({ status: "unsupported", reason: "source-volume-shear" });
  });

  it("refuses on obliquity even when shear is acceptable", () => {
    expect(create(5, 0.05)).toMatchObject({ status: "unsupported", reason: "source-volume-obliquity" });
  });

  it("checks obliquity before shear when both exceed", () => {
    expect(create(5, 5)).toMatchObject({ status: "unsupported", reason: "source-volume-obliquity" });
  });

  it("accepts a volume within both thresholds", () => {
    expect(create(0.5, 0.05).status).toBe("ready");
  });

  it("reports each gate against its own constant", () => {
    const obliquity = create(2, 0);
    const shear = create(0, 0.2);
    expect(obliquity).toMatchObject({ maximumSupportedAngleDeg: MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG });
    expect(shear).toMatchObject({ maximumSupportedShearDeg: MAX_SUPPORTED_SOURCE_SHEAR_DEG });
    // The constants differ, so neither gate can be satisfied by the other's bound.
    expect(MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG).not.toBe(MAX_SUPPORTED_SOURCE_SHEAR_DEG);
  });
});

describe("ready sampler shape", () => {
  it("exposes the requested volume id and RAS dimensions", () => {
    const sampler = readySampler(makeInput({ geometry: makeGeometry({ dimensionsVox: { x: 3, y: 5, z: 7 } }) }));
    expect(sampler.volumeId).toBe("vol");
    expect(sampler.dimensions).toEqual([3, 5, 7]);
  });
});

describe("worldToVoxel", () => {
  const out: MutableVec3 = { x: 0, y: 0, z: 0 };

  it("returns continuous coordinates without rounding", () => {
    const sampler = readySampler();
    sampler.worldToVoxel(0.3, 0.3, 0.3, out);
    // identity affine: frac = mm; vox = frac*4 - 0.5 = 0.7
    expect(out.x).toBeCloseTo(0.7, 9);
    expect(out.y).toBeCloseTo(0.7, 9);
    expect(out.z).toBeCloseTo(0.7, 9);
  });

  it("applies the cached inverse affine", () => {
    // A scaling+translation affine: frac = (mm - t) / s.
    const affine = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 10, 20, 30, 1];
    const sampler = readySampler(makeInput({ image: makeImage({ frac2mmOrtho: affine }) }));
    sampler.worldToVoxel(10, 20, 30, out); // frac (0,0,0) -> vox -0.5
    expect(out.x).toBeCloseTo(-0.5, 9);
    sampler.worldToVoxel(12, 22, 32, out); // frac (1,1,1) -> vox 3.5
    expect(out.x).toBeCloseTo(3.5, 9);
  });

  it("rejects non-finite input", () => {
    const sampler = readySampler();
    expect(sampler.worldToVoxel(Number.NaN, 0, 0, out)).toBe(false);
    expect(sampler.worldToVoxel(0, Infinity, 0, out)).toBe(false);
  });

  it("does not allocate a result object", () => {
    const sampler = readySampler();
    const target: MutableVec3 = { x: -1, y: -1, z: -1 };
    const returned = sampler.worldToVoxel(1, 2, 3, target);
    expect(returned).toBe(true);
    expect(target.x).not.toBe(-1);
  });
});

describe("getVoxel", () => {
  it("delegates in-bounds lookups to getValue verbatim", () => {
    const getValue = vi.fn((x: number, y: number, z: number) => x * 10000 + y * 100 + z);
    const sampler = readySampler(makeInput({ image: makeImage({ getValue }) }));
    expect(sampler.getVoxel(1, 2, 3)).toBe(10203);
    expect(getValue).toHaveBeenCalledWith(1, 2, 3);
  });

  it("returns the scaled value without rescaling it again", () => {
    // getValue already applies slope/intercept; the adapter must not touch it.
    const getValue = vi.fn(() => 4242);
    const sampler = readySampler(makeInput({ image: makeImage({ getValue }) }));
    expect(sampler.getVoxel(0, 0, 0)).toBe(4242);
  });

  it("rejects non-integer coordinates", () => {
    const sampler = readySampler();
    expect(sampler.getVoxel(1.5, 2, 3)).toBeNull();
  });

  it("rejects non-finite coordinates", () => {
    const sampler = readySampler();
    expect(sampler.getVoxel(Number.NaN, 0, 0)).toBeNull();
  });

  it("returns null outside bounds rather than clamping", () => {
    const getValue = vi.fn(() => 1);
    const sampler = readySampler(makeInput({ image: makeImage({ getValue }) }));
    expect(sampler.getVoxel(-1, 0, 0)).toBeNull();
    expect(sampler.getVoxel(4, 0, 0)).toBeNull();
    expect(sampler.getVoxel(0, 0, 4)).toBeNull();
    expect(getValue).not.toHaveBeenCalled();
  });

  it("accepts the last in-bounds voxel", () => {
    const sampler = readySampler();
    expect(sampler.getVoxel(3, 3, 3)).toBe(30303);
  });
});
