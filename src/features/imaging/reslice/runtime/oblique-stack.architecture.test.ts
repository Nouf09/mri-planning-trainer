import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const NIIVUE = /from "@niivue\/niivue"|from '@niivue\/niivue'/;
const stackFiles = [
  "src/features/imaging/reslice/runtime/oblique-stack.types.ts",
  "src/features/imaging/reslice/runtime/build-oblique-stack.ts",
  "src/features/imaging/reslice/runtime/use-oblique-stack.ts",
  "src/features/imaging/components/ObliqueStackViewport.tsx",
];

describe("stack modules respect the imaging boundary", () => {
  it("import no Niivue or NVImage", () => {
    for (const f of stackFiles) {
      const src = readFileSync(f, "utf8");
      expect(NIIVUE.test(src)).toBe(false);
      expect(/\bimport\b[^;]*\bNVImage\b|:\s*NVImage\b/.test(src)).toBe(false);
    }
  });

  it("compute no planning geometry: positions come from sliceOffsetsMm", () => {
    const builder = readFileSync("src/features/imaging/reslice/runtime/build-oblique-stack.ts", "utf8");
    expect(builder).toContain("sliceOffsetsMm");
    // No hand-rolled offset arithmetic.
    expect(/for\s*\([^)]*sliceCount|offset\s*=\s*.*thickness/.test(builder)).toBe(false);
  });

  it("reuse the frozen reslice pipeline, not a new one", () => {
    const builder = readFileSync("src/features/imaging/reslice/runtime/build-oblique-stack.ts", "utf8");
    expect(builder).toContain("prescriptionToResliceRequest");
    expect(builder).toContain("resliceVolume");
    expect(builder).toContain("toGrayscale");
  });

  it("the component performs no reslice or geometry", () => {
    const view = readFileSync("src/features/imaging/components/ObliqueStackViewport.tsx", "utf8");
    expect(/resliceVolume|toGrayscale|worldToVoxel|createSampler|sliceOffsetsMm/.test(view)).toBe(false);
  });
});

describe("Phase 10C single-slice reference is preserved", () => {
  // Phase 10D supersedes the single-slice preview only at the Index layer.
  // The Phase 10C modules are intentionally kept byte-identical as the
  // validated single-slice reference, and the integration suite proves the
  // Phase 10D centre slice reproduces the Phase 10C output numerically.
  const referenceModules = [
    "src/features/imaging/reslice/runtime/build-oblique-preview.ts",
    "src/features/imaging/reslice/runtime/use-oblique-preview.ts",
    "src/features/imaging/components/ObliquePreviewViewport.tsx",
  ];

  it("keeps the reference modules present", () => {
    for (const f of referenceModules) {
      expect(readFileSync(f, "utf8").length).toBeGreaterThan(0);
    }
  });

  it("routes the live app through the stack, not the single-slice preview", () => {
    const index = readFileSync("src/pages/Index.tsx", "utf8");
    expect(index).toContain("ObliqueStackViewport");
    expect(index).toContain("useObliqueStack");
    expect(index).not.toContain("useObliquePreview");
    expect(index).not.toContain("ObliquePreviewViewport");
  });
});
