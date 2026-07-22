import { describe, it, expect } from "vitest";
import { sampleTrilinear } from "@/features/imaging/reslice/interpolation";
import { resliceVolume } from "@/features/imaging/reslice/reslice-volume";
import type { ObliqueSliceRequest } from "@/features/imaging/reslice/oblique-slice-request";
import {
  createGradientVolume,
  gradientValueAt,
} from "@/features/imaging/reslice/testing/synthetic-volume";

/** Named once so every analytic comparison uses the same bound. */
const TRILINEAR_TOLERANCE = 1e-6;

const GRADIENT = { volumeId: "gradient", dimensions: [5, 7, 3] as const, a: 1, b: 10, c: 100, d: 5 };

function makeRequest(overrides: Partial<ObliqueSliceRequest> = {}): ObliqueSliceRequest {
  return {
    volumeId: "gradient",
    centerWorldMm: { x: 2, y: 3, z: 1 },
    readDirectionWorld: { x: 1, y: 0, z: 0 },
    phaseDirectionWorld: { x: 0, y: 1, z: 0 },
    normalDirectionWorld: { x: 0, y: 0, z: 1 },
    fovReadMm: 4,
    fovPhaseMm: 6,
    sliceOffsetMm: 0,
    outputWidthPx: 4,
    outputHeightPx: 6,
    interpolation: "trilinear",
    outOfBounds: "transparent",
    ...overrides,
  };
}

describe("trilinear sampling against an analytic field", () => {
  const volume = createGradientVolume(GRADIENT);

  it("is exact on integer coordinates", () => {
    expect(sampleTrilinear(volume, 2, 3, 1, false)).toBeCloseTo(gradientValueAt(GRADIENT, 2, 3, 1), 9);
  });

  it("is exact at a midpoint", () => {
    expect(sampleTrilinear(volume, 1.5, 2.5, 0.5, false)).toBeCloseTo(
      gradientValueAt(GRADIENT, 1.5, 2.5, 0.5),
      9
    );
  });

  it("is exact at an arbitrary fractional point", () => {
    const [x, y, z] = [1.234, 4.567, 0.891];
    expect(sampleTrilinear(volume, x, y, z, false)).toBeCloseTo(gradientValueAt(GRADIENT, x, y, z), 6);
  });

  it("reproduces a linear field everywhere within tolerance", () => {
    for (let x = 0; x <= 4; x += 0.37) {
      for (let y = 0; y <= 6; y += 0.53) {
        const value = sampleTrilinear(volume, x, y, 1.25, false)!;
        expect(Math.abs(value - gradientValueAt(GRADIENT, x, y, 1.25))).toBeLessThan(TRILINEAR_TOLERANCE);
      }
    }
  });

  it("is exact at the upper edge, where the neighbour is capped", () => {
    expect(sampleTrilinear(volume, 4, 6, 2, false)).toBeCloseTo(gradientValueAt(GRADIENT, 4, 6, 2), 9);
  });
});

describe("trilinear bounds behaviour", () => {
  const volume = createGradientVolume(GRADIENT);

  it("returns nothing outside the volume in transparent mode", () => {
    expect(sampleTrilinear(volume, -0.01, 3, 1, false)).toBeNull();
    expect(sampleTrilinear(volume, 4.01, 3, 1, false)).toBeNull();
  });

  it("clamps to the boundary when asked", () => {
    expect(sampleTrilinear(volume, -5, 3, 1, true)).toBeCloseTo(gradientValueAt(GRADIENT, 0, 3, 1), 9);
    expect(sampleTrilinear(volume, 99, 3, 1, true)).toBeCloseTo(gradientValueAt(GRADIENT, 4, 3, 1), 9);
  });

  it("never wraps a far coordinate to the opposite edge", () => {
    const clamped = sampleTrilinear(volume, 99, 3, 1, true)!;
    expect(clamped).not.toBeCloseTo(gradientValueAt(GRADIENT, 0, 3, 1), 6);
  });

  it("rejects non-finite coordinates", () => {
    expect(sampleTrilinear(volume, Number.NaN, 3, 1, false)).toBeNull();
    expect(sampleTrilinear(volume, 2, Infinity, 1, true)).toBeNull();
  });
});

describe("trilinear reslicing", () => {
  const volume = createGradientVolume(GRADIENT);

  const sliceOf = (request: ObliqueSliceRequest, v = volume) => {
    const outcome = resliceVolume(request, v);
    if (outcome.status !== "ok") throw new Error(outcome.status);
    return outcome.slice;
  };

  it("matches the analytic field at every sampled pixel", () => {
    const request = makeRequest();
    const slice = sliceOf(request);
    for (let row = 0; row < slice.height; row++) {
      for (let col = 0; col < slice.width; col++) {
        const index = row * slice.width + col;
        if (slice.alpha[index] === 0) continue;
        const uMm = ((col + 0.5) / slice.width - 0.5) * request.fovReadMm;
        const vMm = (0.5 - (row + 0.5) / slice.height) * request.fovPhaseMm;
        const expected = gradientValueAt(GRADIENT, 2 + uMm, 3 + vMm, 1);
        expect(Math.abs(slice.intensities[index] - expected)).toBeLessThan(TRILINEAR_TOLERANCE);
      }
    }
  });

  it("handles anisotropic spacing", () => {
    const anisotropic = createGradientVolume({ ...GRADIENT, spacing: [2, 1, 1] as const });
    const slice = sliceOf(makeRequest({ centerWorldMm: { x: 4, y: 3, z: 1 }, fovReadMm: 4 }), anisotropic);
    const centreIndex = 3 * slice.width + 2;
    expect(slice.alpha[centreIndex]).toBe(255);
    expect(slice.intensities[centreIndex]).toBeCloseTo(gradientValueAt(GRADIENT, 2.25, 2.5, 1), 6);
  });

  it("handles a translated transform", () => {
    const translated = createGradientVolume({ ...GRADIENT, origin: [100, 200, 300] as const });
    const slice = sliceOf(makeRequest({ centerWorldMm: { x: 102, y: 203, z: 301 } }), translated);
    expect(slice.minIntensity).not.toBeNull();
  });

  it("advances along the normal", () => {
    const lower = sliceOf(makeRequest({ sliceOffsetMm: -1 }));
    const upper = sliceOf(makeRequest({ sliceOffsetMm: 1 }));
    const centre = 3 * 4 + 2;
    expect(upper.intensities[centre] - lower.intensities[centre]).toBeCloseTo(200, 6);
  });

  it("marks outside samples transparent, not dark", () => {
    const slice = sliceOf(makeRequest({ fovReadMm: 40, outputWidthPx: 20 }));
    expect(slice.alpha[0]).toBe(0);
    expect(slice.intensities[0]).toBe(0);
  });

  it("fills the plane when clamping", () => {
    const slice = sliceOf(makeRequest({ fovReadMm: 40, outputWidthPx: 20, outOfBounds: "clamp" }));
    expect(Array.from(slice.alpha).every((a) => a === 255)).toBe(true);
  });
});
