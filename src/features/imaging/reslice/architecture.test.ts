import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Production sources in the reslice layer, excluding tests and test support. */
const RESLICE_DIR = "src/features/imaging/reslice";

function productionFiles(): string[] {
  return readdirSync(RESLICE_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(RESLICE_DIR, name));
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ["React", /from "react"|from 'react'/],
  ["Canvas", /CanvasRenderingContext2D|ImageData|OffscreenCanvas/],
  ["DOM", /\bdocument\.|\bwindow\.|HTMLCanvasElement|HTMLElement/],
  ["Niivue", /niivue/i],
  ["WebGL", /WebGL|webgl/],
  ["planning hooks", /use-planning-session|usePlanningSession/],
  ["renderers", /overlays\/|renderer/],
  ["projection layer", /projection\//],
];

describe("reslice layer stays framework independent", () => {
  const files = productionFiles();

  it("has production sources to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`imports no ${label}`, () => {
      const offenders = files.filter((file) => pattern.test(readFileSync(file, "utf8")));
      expect(offenders).toEqual([]);
    });
  }

  it("depends on the planning domain only for pure types", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      const planningImports = source.match(/from "@\/features\/planning\/[^"]+"/g) ?? [];
      // Only pure domain modules are acceptable dependencies.
      return planningImports.some((line) => !line.includes("/planning/domain/"));
    });
    expect(offenders).toEqual([]);
  });
});
