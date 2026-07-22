import { describe, it, expect } from "vitest";
import {
  BASIS_TOLERANCE,
  validateObliqueSliceRequest,
  type ObliqueSliceRequest,
} from "@/features/imaging/reslice/oblique-slice-request";

function makeRequest(overrides: Partial<ObliqueSliceRequest> = {}): ObliqueSliceRequest {
  return {
    volumeId: "synthetic",
    centerWorldMm: { x: 0, y: 0, z: 0 },
    readDirectionWorld: { x: 1, y: 0, z: 0 },
    phaseDirectionWorld: { x: 0, y: 1, z: 0 },
    normalDirectionWorld: { x: 0, y: 0, z: 1 },
    fovReadMm: 100,
    fovPhaseMm: 80,
    sliceOffsetMm: 0,
    outputWidthPx: 16,
    outputHeightPx: 8,
    interpolation: "trilinear",
    outOfBounds: "transparent",
    ...overrides,
  };
}

const reasonOf = (r: ObliqueSliceRequest) => {
  const result = validateObliqueSliceRequest(r);
  return result.status === "valid" ? null : result.reason;
};

describe("request validation accepts valid input", () => {
  it("accepts a well-formed request", () => {
    expect(validateObliqueSliceRequest(makeRequest())).toEqual({ status: "valid" });
  });

  it("accepts either interpolation mode", () => {
    expect(validateObliqueSliceRequest(makeRequest({ interpolation: "nearest" })).status).toBe("valid");
    expect(validateObliqueSliceRequest(makeRequest({ interpolation: "trilinear" })).status).toBe("valid");
  });

  it("accepts either out-of-bounds mode", () => {
    expect(validateObliqueSliceRequest(makeRequest({ outOfBounds: "clamp" })).status).toBe("valid");
  });

  it("accepts a rotated but still right-handed basis", () => {
    const c = Math.SQRT1_2;
    expect(
      validateObliqueSliceRequest(
        makeRequest({
          readDirectionWorld: { x: c, y: c, z: 0 },
          phaseDirectionWorld: { x: -c, y: c, z: 0 },
          normalDirectionWorld: { x: 0, y: 0, z: 1 },
        })
      ).status
    ).toBe("valid");
  });
});

describe("request validation rejects invalid dimensions and extents", () => {
  it("rejects non-positive output dimensions", () => {
    expect(reasonOf(makeRequest({ outputWidthPx: 0 }))).toMatch(/outputWidthPx/);
    expect(reasonOf(makeRequest({ outputHeightPx: -4 }))).toMatch(/outputHeightPx/);
  });

  it("rejects fractional output dimensions", () => {
    expect(reasonOf(makeRequest({ outputWidthPx: 10.5 }))).toMatch(/outputWidthPx/);
  });

  it("rejects non-positive field of view", () => {
    expect(reasonOf(makeRequest({ fovReadMm: 0 }))).toMatch(/fovReadMm/);
    expect(reasonOf(makeRequest({ fovPhaseMm: -1 }))).toMatch(/fovPhaseMm/);
  });

  it("rejects an empty volume id", () => {
    expect(reasonOf(makeRequest({ volumeId: "" }))).toMatch(/volumeId/);
  });
});

describe("request validation rejects non-finite values", () => {
  it("rejects a non-finite slice offset", () => {
    expect(reasonOf(makeRequest({ sliceOffsetMm: Number.NaN }))).toMatch(/sliceOffsetMm/);
  });

  it("rejects a non-finite centre", () => {
    expect(reasonOf(makeRequest({ centerWorldMm: { x: Infinity, y: 0, z: 0 } }))).toMatch(/centerWorldMm/);
  });

  it("rejects a non-finite basis vector", () => {
    expect(reasonOf(makeRequest({ readDirectionWorld: { x: Number.NaN, y: 0, z: 0 } }))).toMatch(/readDirectionWorld/);
  });

  it("rejects a non-finite field of view", () => {
    expect(reasonOf(makeRequest({ fovReadMm: Infinity }))).toMatch(/fovReadMm/);
  });
});

describe("request validation rejects malformed bases", () => {
  it("rejects a zero-length vector", () => {
    expect(reasonOf(makeRequest({ readDirectionWorld: { x: 0, y: 0, z: 0 } }))).toMatch(/zero length/);
  });

  it("rejects a non-unit vector", () => {
    expect(reasonOf(makeRequest({ readDirectionWorld: { x: 2, y: 0, z: 0 } }))).toMatch(/unit length/);
  });

  it("rejects a non-orthogonal basis", () => {
    const c = Math.SQRT1_2;
    expect(
      reasonOf(makeRequest({ phaseDirectionWorld: { x: c, y: c, z: 0 } }))
    ).toMatch(/orthogonal/);
  });

  it("rejects a left-handed basis", () => {
    expect(reasonOf(makeRequest({ normalDirectionWorld: { x: 0, y: 0, z: -1 } }))).toMatch(/right-handed/);
  });

  it("does not repair a malformed basis silently", () => {
    const request = makeRequest({ readDirectionWorld: { x: 3, y: 0, z: 0 } });
    validateObliqueSliceRequest(request);
    expect(request.readDirectionWorld).toEqual({ x: 3, y: 0, z: 0 });
  });

  it("uses a named tolerance", () => {
    expect(BASIS_TOLERANCE).toBe(1e-6);
    const nearlyUnit = { x: 1 + BASIS_TOLERANCE / 2, y: 0, z: 0 };
    expect(validateObliqueSliceRequest(makeRequest({ readDirectionWorld: nearlyUnit })).status).toBe("valid");
  });
});

describe("request validation rejects invalid modes", () => {
  it("rejects an unknown interpolation mode", () => {
    expect(reasonOf(makeRequest({ interpolation: "cubic" as never }))).toMatch(/interpolation/);
  });

  it("rejects an unknown out-of-bounds mode", () => {
    expect(reasonOf(makeRequest({ outOfBounds: "wrap" as never }))).toMatch(/outOfBounds/);
  });
});
