import { describe, it, expect } from "vitest";
import {
  OBLIQUE_PREVIEW_MAX_PX,
  previewOutputDimensions,
} from "@/features/imaging/reslice/runtime/preview-output-dimensions";

describe("previewOutputDimensions", () => {
  it("uses a square matrix for a square field of view", () => {
    expect(previewOutputDimensions(230, 230)).toEqual({ width: 256, height: 256 });
  });

  it("caps width for a landscape field of view", () => {
    expect(previewOutputDimensions(256, 128)).toEqual({ width: 256, height: 128 });
  });

  it("caps height for a portrait field of view", () => {
    expect(previewOutputDimensions(128, 256)).toEqual({ width: 128, height: 256 });
  });

  it("preserves the physical aspect ratio", () => {
    const dims = previewOutputDimensions(230, 190)!;
    expect(dims.width / dims.height).toBeCloseTo(230 / 190, 1);
    expect(Math.max(dims.width, dims.height)).toBe(OBLIQUE_PREVIEW_MAX_PX);
  });

  it("never falls below one pixel for an extreme ratio", () => {
    const dims = previewOutputDimensions(4000, 1)!;
    expect(dims.width).toBe(256);
    expect(dims.height).toBe(1);
  });

  it("rejects a non-positive field of view", () => {
    expect(previewOutputDimensions(0, 100)).toBeNull();
    expect(previewOutputDimensions(100, -5)).toBeNull();
  });

  it("rejects a non-finite field of view", () => {
    expect(previewOutputDimensions(NaN, 100)).toBeNull();
    expect(previewOutputDimensions(100, Infinity)).toBeNull();
  });
});
