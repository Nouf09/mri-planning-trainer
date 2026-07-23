import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const NIIVUE_IMPORT = /from "@niivue\/niivue"|from '@niivue\/niivue'/;

function productionFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .filter((name) => !name.includes(".test."))
    .map((name) => join(dir, name));
}

describe("preview runtime stays framework-clean", () => {
  const runtimeFiles = productionFiles("src/features/imaging/reslice/runtime");
  const componentFiles = productionFiles("src/features/imaging/components");

  it("has files to check", () => {
    expect(runtimeFiles.length).toBeGreaterThan(0);
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  it("no preview production file imports Niivue", () => {
    const all = [...runtimeFiles, ...componentFiles];
    const offenders = all.filter((f) => NIIVUE_IMPORT.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no preview production file mentions NVImage in code", () => {
    const all = [...runtimeFiles, ...componentFiles];
    const offenders = all.filter((f) => /:\s*NVImage\b|<NVImage\b|\bimport\b[^;]*\bNVImage\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the pure runtime layer imports no React except the hook", () => {
    const reactImporters = runtimeFiles.filter((f) => /from "react"/.test(readFileSync(f, "utf8")));
    expect(reactImporters.map((f) => f.split("/").pop())).toEqual(["use-oblique-preview.ts"]);
  });

  it("the painter performs no reslice, mapping, or affine work", () => {
    const painter = readFileSync("src/features/imaging/components/oblique-preview-painter.ts", "utf8");
    expect(/resliceVolume|toGrayscale|worldToVoxel|frac2mm|createSampler|projectPrescription/.test(painter)).toBe(false);
  });

  it("the reslice engine core still imports no React or Canvas", () => {
    const core = productionFiles("src/features/imaging/reslice");
    for (const f of core) {
      const src = readFileSync(f, "utf8");
      expect(/from "react"|CanvasRenderingContext2D|ImageData/.test(src)).toBe(false);
    }
  });
});
