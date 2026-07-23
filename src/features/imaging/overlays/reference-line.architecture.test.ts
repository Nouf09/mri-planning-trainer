import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const RENDERER = "src/features/imaging/overlays/reference-line-renderer.ts";
const HELPER = "src/features/planning/domain/selected-slice-position.ts";
const VIEWPORT = "src/components/MedicalViewport.tsx";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("reference line stays a pure, read-only visualization", () => {
  it("the renderer does no geometry, reslice, sampling, or hit testing", () => {
    const src = read(RENDERER);
    expect(
      /resliceVolume|createSampler|worldToVoxel|sliceOffsetsMm|projectPrescription|hit-test|from "react"|@niivue/.test(
        src
      )
    ).toBe(false);
  });

  it("the world-position helper reuses sliceOffsetsMm rather than re-deriving offsets", () => {
    const src = read(HELPER);
    expect(src).toContain("sliceOffsetsMm");
    // No hand-rolled spacing arithmetic — offsets come only from planning.
    expect(/sliceGap|sliceThickness|sliceCount/.test(src)).toBe(false);
    // Purely geometric: it never reslices or samples.
    expect(/resliceVolume|createSampler|worldToVoxel/.test(src)).toBe(false);
  });

  it("the viewport draws the reference line from the shared projection outline", () => {
    const src = read(VIEWPORT);
    expect(src).toContain("referenceLine.render(ctx, projection.sliceOutlines[highlightedSliceIndex])");
  });

  it("the reference line adds no reslice or extra projection to the viewport", () => {
    const src = read(VIEWPORT);
    // The highlight reuses the one existing projection; it computes no offsets
    // and triggers no resampling of the stack.
    const projectionCalls = src.match(/projectPrescription\(/g) ?? [];
    expect(projectionCalls.length).toBe(1);
    expect(/resliceVolume|sliceOffsetsMm|useObliqueStack/.test(src)).toBe(false);
  });
});
