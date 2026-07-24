import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const VIEWPORT = "src/components/MedicalViewport.tsx";
const INDEX = "src/pages/Index.tsx";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function productionFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .filter((name) => !name.includes(".test."))
    .map((name) => join(dir, name));
}

describe("planning mode is resolved once at the composition root", () => {
  it("MedicalViewport neither imports nor calls the planning-mode resolvers", () => {
    const src = read(VIEWPORT);
    expect(/resolvePlanningMode|resolveEffectivePlanningMode/.test(src)).toBe(false);
  });

  it("MedicalViewport consumes the resolved values as typed props", () => {
    const src = read(VIEWPORT);
    expect(/planningMode:\s*PlanningMode/.test(src)).toBe(true);
    expect(/engineKind:\s*ImagingEngineKind/.test(src)).toBe(true);
  });

  it("MedicalViewport hands the resolved engine kind to useImagingEngine", () => {
    const src = read(VIEWPORT);
    expect(/useImagingEngine\(\s*engineKind\s*\)/.test(src)).toBe(true);
    // The viewport never falls back to reading the URL itself.
    expect(/resolveImagingEngineKind/.test(src)).toBe(false);
  });

  it("Index is the single effective-mode resolution site and passes both values down", () => {
    const src = read(INDEX);
    const calls = src.match(/resolveEffectivePlanningMode\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(/planningMode=\{planningMode\}/.test(src)).toBe(true);
    expect(/engineKind=\{engineKind\}/.test(src)).toBe(true);
  });

  it("useImagingEngine requires an injected kind and never resolves the URL itself", () => {
    const src = read("src/features/imaging/hooks/use-imaging-engine.ts");
    expect(/resolveImagingEngineKind/.test(src)).toBe(false);
    // Required parameter: a typed kind with neither a default nor an optional marker.
    expect(/useImagingEngine\(\s*kind:\s*ImagingEngineKind\s*\)/.test(src)).toBe(true);
    expect(/kind\?\s*:|kind:\s*ImagingEngineKind\s*=/.test(src)).toBe(false);
  });

  it("no other composition-layer file recomputes the effective planning mode", () => {
    const files = [...productionFiles("src/components"), ...productionFiles("src/pages")];
    const offenders = files
      .filter((f) => !f.endsWith("Index.tsx"))
      .filter((f) => /resolveEffectivePlanningMode|resolvePlanningMode\(/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
