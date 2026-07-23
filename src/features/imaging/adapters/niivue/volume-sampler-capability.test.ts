import { describe, it, expect, vi } from "vitest";
import {
  buildVolumeSamplerCapability,
  pickIntensityWindow,
  type NiivueVolumeImageLike,
} from "@/features/imaging/adapters/niivue/volume-sampler-capability";

/** A complete, canonical image surface. */
function makeImage(overrides: Partial<NiivueVolumeImageLike> = {}): NiivueVolumeImageLike {
  return {
    frac2mmOrtho: [6, 0, 0, 0, 0, 8, 0, 0, 0, 0, 10, 0, -11, -21, -31, 1],
    getValue: (x, y, z) => x * 10000 + y * 100 + z,
    dimsRAS: [3, 3, 4, 5],
    pixDimsRAS: [1, 2, 2, 2],
    extentsMinOrtho: [-11, -21, -31],
    extentsMaxOrtho: [7, 11, 19],
    oblique_angle: 0,
    maxShearDeg: 0,
    cal_min: 0,
    cal_max: 1000,
    robust_min: 10,
    robust_max: 900,
    global_min: -5,
    global_max: 1100,
    ...overrides,
  };
}

describe("pickIntensityWindow fallback order", () => {
  it("prefers a valid cal window", () => {
    expect(pickIntensityWindow(makeImage())).toEqual({ min: 0, max: 1000, source: "cal" });
  });

  it("falls back to robust when cal is invalid", () => {
    const image = makeImage({ cal_min: 5, cal_max: 5 });
    expect(pickIntensityWindow(image)).toEqual({ min: 10, max: 900, source: "robust" });
  });

  it("falls back to global when cal and robust are invalid", () => {
    const image = makeImage({ cal_min: NaN, cal_max: 1, robust_min: 3, robust_max: 3 });
    expect(pickIntensityWindow(image)).toEqual({ min: -5, max: 1100, source: "global" });
  });

  it("skips non-finite candidates", () => {
    const image = makeImage({ cal_min: -Infinity, cal_max: 1, robust_min: 0, robust_max: Infinity });
    expect(pickIntensityWindow(image)?.source).toBe("global");
  });

  it("skips windows where max is not greater than min", () => {
    const image = makeImage({ cal_min: 10, cal_max: 10, robust_min: 20, robust_max: 5 });
    expect(pickIntensityWindow(image)?.source).toBe("global");
  });

  it("returns null when no window is valid", () => {
    const image = makeImage({
      cal_min: NaN, cal_max: NaN,
      robust_min: 5, robust_max: 5,
      global_min: 10, global_max: 1,
    });
    expect(pickIntensityWindow(image)).toBeNull();
  });
});

describe("buildVolumeSamplerCapability", () => {
  it("returns a capability with identity, geometry and window", () => {
    const cap = buildVolumeSamplerCapability("vol-1", makeImage());
    expect(cap).not.toBeNull();
    expect(cap!.volumeIdentity).toBe("vol-1");
    expect(cap!.geometry.coordinateSystem).toBe("niivue-ortho-mm");
    expect(cap!.intensityWindow.source).toBe("cal");
  });

  it("is null for an empty identity", () => {
    expect(buildVolumeSamplerCapability("", makeImage())).toBeNull();
  });

  it("is null when geometry cannot be read", () => {
    expect(buildVolumeSamplerCapability("v", makeImage({ dimsRAS: undefined }))).toBeNull();
  });

  it("is null when no valid window exists", () => {
    const noWindow = makeImage({
      cal_min: NaN, cal_max: NaN, robust_min: NaN, robust_max: NaN, global_min: NaN, global_max: NaN,
    });
    expect(buildVolumeSamplerCapability("v", noWindow)).toBeNull();
  });

  it("delegates sampler creation to the gated Phase 10B factory", () => {
    const cap = buildVolumeSamplerCapability("vol-1", makeImage())!;
    const result = cap.createSampler();
    expect(result.status).toBe("ready");
  });

  it("refuses an oblique source through the sampler gate", () => {
    const cap = buildVolumeSamplerCapability("v", makeImage({ oblique_angle: 5 }))!;
    expect(cap.createSampler()).toMatchObject({ status: "unsupported", reason: "source-volume-obliquity" });
  });

  it("does not read the image until createSampler is called", () => {
    const getValue = vi.fn(() => 0);
    const cap = buildVolumeSamplerCapability("v", makeImage({ getValue }))!;
    expect(getValue).not.toHaveBeenCalled();
    const result = cap.createSampler();
    if (result.status === "ready") result.sampler.getVoxel(0, 0, 0);
    expect(getValue).toHaveBeenCalled();
  });
});
