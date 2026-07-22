import { describe, it, expect } from "vitest";
import { resliceVolume } from "@/features/imaging/reslice/reslice-volume";
import type { ObliqueSliceRequest } from "@/features/imaging/reslice/oblique-slice-request";
import {
  MARKER_VALUE,
  createCoordinateVolume,
  decodeCoordinate,
  encodeCoordinate,
} from "@/features/imaging/reslice/testing/synthetic-volume";

/** 1 mm isotropic, voxel (0,0,0) at world origin, asymmetric dims 5x7x3. */
const VOLUME_OPTIONS = { volumeId: "synthetic", dimensions: [5, 7, 3] as const };

function makeRequest(overrides: Partial<ObliqueSliceRequest> = {}): ObliqueSliceRequest {
  return {
    volumeId: "synthetic",
    centerWorldMm: { x: 2, y: 3, z: 1 },
    readDirectionWorld: { x: 1, y: 0, z: 0 },
    phaseDirectionWorld: { x: 0, y: 1, z: 0 },
    normalDirectionWorld: { x: 0, y: 0, z: 1 },
    fovReadMm: 5,
    fovPhaseMm: 7,
    sliceOffsetMm: 0,
    outputWidthPx: 5,
    outputHeightPx: 7,
    interpolation: "nearest",
    outOfBounds: "transparent",
    ...overrides,
  };
}

function sliceOf(request: ObliqueSliceRequest, volume = createCoordinateVolume(VOLUME_OPTIONS)) {
  const outcome = resliceVolume(request, volume);
  if (outcome.status !== "ok") throw new Error(`expected ok, got ${outcome.status}`);
  return outcome.slice;
}

const at = (slice: ReturnType<typeof sliceOf>, col: number, row: number) =>
  slice.intensities[row * slice.width + col];

describe("nearest sampling decodes coordinates exactly", () => {
  it("samples the centre pixel at the plane centre", () => {
    const slice = sliceOf(makeRequest());
    // 5 columns across 5 mm centred at x=2 puts column 2 exactly on voxel x=2.
    expect(decodeCoordinate(at(slice, 2, 3))).toEqual({ x: 2, y: 3, z: 1 });
  });

  it("walks the read axis across columns", () => {
    const slice = sliceOf(makeRequest());
    for (let column = 0; column < 5; column++) {
      expect(decodeCoordinate(at(slice, column, 3)).x).toBe(column);
    }
  });

  it("puts row 0 at the positive phase edge", () => {
    const slice = sliceOf(makeRequest());
    // Phase is +y, so the topmost row must hold the largest y.
    expect(decodeCoordinate(at(slice, 2, 0)).y).toBe(6);
    expect(decodeCoordinate(at(slice, 2, 6)).y).toBe(0);
  });

  it("does not flip the image vertically", () => {
    const slice = sliceOf(makeRequest());
    const top = decodeCoordinate(at(slice, 2, 0)).y;
    const bottom = decodeCoordinate(at(slice, 2, 6)).y;
    expect(top).toBeGreaterThan(bottom);
  });
});

describe("nearest sampling across cardinal planes", () => {
  it("samples an axial plane", () => {
    const slice = sliceOf(makeRequest());
    expect(decodeCoordinate(at(slice, 0, 6))).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("samples a coronal plane", () => {
    const slice = sliceOf(
      makeRequest({
        readDirectionWorld: { x: 1, y: 0, z: 0 },
        phaseDirectionWorld: { x: 0, y: 0, z: 1 },
        normalDirectionWorld: { x: 0, y: -1, z: 0 },
        fovReadMm: 5,
        fovPhaseMm: 3,
        outputWidthPx: 5,
        outputHeightPx: 3,
      })
    );
    expect(decodeCoordinate(at(slice, 2, 1))).toEqual({ x: 2, y: 3, z: 1 });
    expect(decodeCoordinate(at(slice, 2, 0)).z).toBe(2);
  });

  it("samples a sagittal plane", () => {
    const slice = sliceOf(
      makeRequest({
        readDirectionWorld: { x: 0, y: 1, z: 0 },
        phaseDirectionWorld: { x: 0, y: 0, z: 1 },
        normalDirectionWorld: { x: 1, y: 0, z: 0 },
        fovReadMm: 7,
        fovPhaseMm: 3,
        outputWidthPx: 7,
        outputHeightPx: 3,
      })
    );
    expect(decodeCoordinate(at(slice, 3, 1))).toEqual({ x: 2, y: 3, z: 1 });
  });

  it("samples an arbitrary oblique plane without wrapping", () => {
    const c = Math.SQRT1_2;
    const slice = sliceOf(
      makeRequest({
        readDirectionWorld: { x: c, y: c, z: 0 },
        phaseDirectionWorld: { x: -c, y: c, z: 0 },
        normalDirectionWorld: { x: 0, y: 0, z: 1 },
        fovReadMm: 3,
        fovPhaseMm: 3,
        outputWidthPx: 3,
        outputHeightPx: 3,
      })
    );
    expect(decodeCoordinate(at(slice, 1, 1))).toEqual({ x: 2, y: 3, z: 1 });
    for (let i = 0; i < slice.intensities.length; i++) {
      if (slice.alpha[i] === 255) expect(slice.intensities[i]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("nearest sampling geometry", () => {
  it("advances along the normal with sliceOffsetMm", () => {
    const below = sliceOf(makeRequest({ sliceOffsetMm: -1 }));
    const above = sliceOf(makeRequest({ sliceOffsetMm: 1 }));
    expect(decodeCoordinate(at(below, 2, 3)).z).toBe(0);
    expect(decodeCoordinate(at(above, 2, 3)).z).toBe(2);
  });

  it("handles anisotropic spacing", () => {
    const options = { ...VOLUME_OPTIONS, spacing: [2, 1, 1] as const };
    const slice = sliceOf(
      makeRequest({ centerWorldMm: { x: 4, y: 3, z: 1 }, fovReadMm: 10, outputWidthPx: 5 }),
      createCoordinateVolume(options)
    );
    expect(decodeCoordinate(at(slice, 2, 3)).x).toBe(2);
    expect(decodeCoordinate(at(slice, 0, 3)).x).toBe(0);
  });

  it("handles a translated transform", () => {
    const options = { ...VOLUME_OPTIONS, origin: [100, 200, 300] as const };
    const slice = sliceOf(
      makeRequest({ centerWorldMm: { x: 102, y: 203, z: 301 } }),
      createCoordinateVolume(options)
    );
    expect(decodeCoordinate(at(slice, 2, 3))).toEqual({ x: 2, y: 3, z: 1 });
  });

  it("handles a negative determinant transform", () => {
    const options = { ...VOLUME_OPTIONS, axisSign: [-1, 1, 1] as const };
    const slice = sliceOf(
      makeRequest({ centerWorldMm: { x: -2, y: 3, z: 1 } }),
      createCoordinateVolume(options)
    );
    // Mirroring x means increasing world x now walks voxel x downward.
    expect(decodeCoordinate(at(slice, 0, 3)).x).toBe(4);
    expect(decodeCoordinate(at(slice, 4, 3)).x).toBe(0);
  });

  it("finds an asymmetric marker on the expected side", () => {
    const volume = createCoordinateVolume({ ...VOLUME_OPTIONS, markerAt: [0, 0, 1] });
    const slice = sliceOf(makeRequest(), volume);
    expect(at(slice, 0, 6)).toBe(MARKER_VALUE);
    expect(at(slice, 4, 6)).not.toBe(MARKER_VALUE);
  });
});

describe("nearest sampling bounds policy", () => {
  it("marks samples outside the volume transparent", () => {
    const slice = sliceOf(makeRequest({ fovReadMm: 20, outputWidthPx: 20 }));
    expect(slice.alpha[0]).toBe(0);
    expect(slice.intensities[0]).toBe(0);
  });

  it("clamps to the edge when asked", () => {
    const slice = sliceOf(makeRequest({ fovReadMm: 20, outputWidthPx: 20, outOfBounds: "clamp" }));
    expect(slice.alpha[0]).toBe(255);
    expect(decodeCoordinate(slice.intensities[0]).x).toBe(0);
  });

  it("never wraps around the far edge", () => {
    const slice = sliceOf(makeRequest({ fovReadMm: 20, outputWidthPx: 20, outOfBounds: "clamp" }));
    const row = 3;
    const first = decodeCoordinate(slice.intensities[row * 20]).x;
    const last = decodeCoordinate(slice.intensities[row * 20 + 19]).x;
    expect(first).toBe(0);
    expect(last).toBe(4);
  });

  it("rounds a negative fraction into the first voxel rather than out of bounds", () => {
    const slice = sliceOf(makeRequest({ centerWorldMm: { x: 1.8, y: 3, z: 1 }, fovReadMm: 5, outputWidthPx: 5 }));
    expect(slice.alpha[3 * 5]).toBe(255);
  });
});

describe("reslice outcome guards", () => {
  it("rejects an invalid request", () => {
    const outcome = resliceVolume(makeRequest({ fovReadMm: 0 }), createCoordinateVolume(VOLUME_OPTIONS));
    expect(outcome.status).toBe("invalid-request");
  });

  it("rejects a sampler for a different volume", () => {
    const outcome = resliceVolume(makeRequest({ volumeId: "other" }), createCoordinateVolume(VOLUME_OPTIONS));
    expect(outcome.status).toBe("volume-mismatch");
  });
});

describe("reslice output shape", () => {
  it("allocates row-major buffers of the requested size", () => {
    const slice = sliceOf(makeRequest({ outputWidthPx: 4, outputHeightPx: 6 }));
    expect(slice.width).toBe(4);
    expect(slice.height).toBe(6);
    expect(slice.intensities).toHaveLength(24);
    expect(slice.alpha).toHaveLength(24);
  });

  it("reports extremes over sampled pixels only", () => {
    const slice = sliceOf(makeRequest());
    expect(slice.minIntensity).toBe(encodeCoordinate(0, 0, 1));
    expect(slice.maxIntensity).toBe(encodeCoordinate(4, 6, 1));
  });

  it("reports null extremes when nothing was sampled", () => {
    const slice = sliceOf(makeRequest({ centerWorldMm: { x: 900, y: 900, z: 900 } }));
    expect(slice.minIntensity).toBeNull();
    expect(slice.maxIntensity).toBeNull();
    expect(Array.from(slice.alpha).every((a) => a === 0)).toBe(true);
  });

  it("allocates fresh buffers per call", () => {
    const first = sliceOf(makeRequest());
    const second = sliceOf(makeRequest());
    expect(first.intensities).not.toBe(second.intensities);
    expect(first.alpha).not.toBe(second.alpha);
    expect(Array.from(first.intensities)).toEqual(Array.from(second.intensities));
  });

  it("is deterministic across repeated calls", () => {
    const a = sliceOf(makeRequest({ sliceOffsetMm: 0.37 }));
    const b = sliceOf(makeRequest({ sliceOffsetMm: 0.37 }));
    expect(Array.from(a.intensities)).toEqual(Array.from(b.intensities));
  });
});
