import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import {
  createNiivueVolumeSampler,
  type NiivueImageLike,
} from "@/features/imaging/adapters/niivue/niivue-volume-sampler";

const RESLICE_DIR = "src/features/imaging/reslice";
const SAMPLER_FILE = "src/features/imaging/adapters/niivue/niivue-volume-sampler.ts";
const NIIVUE_IMPORT = /from "@niivue\/niivue"|from '@niivue\/niivue'/;

function reslicalProductionFiles(): string[] {
  return readdirSync(RESLICE_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(RESLICE_DIR, name));
}

describe("reslice package remains Niivue-free", () => {
  it("no reslice production file imports Niivue", () => {
    const offenders = reslicalProductionFiles().filter((file) =>
      NIIVUE_IMPORT.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});

describe("the sampler adapter is a clean boundary", () => {
  const source = readFileSync(SAMPLER_FILE, "utf8");

  it("does not import Niivue, using a structural image type instead", () => {
    // No Niivue import, and NVImage never appears in an import or type position
    // (a documentation mention in a comment is fine).
    expect(NIIVUE_IMPORT.test(source)).toBe(false);
    expect(/\bimport\b[^;]*\bNVImage\b/.test(source)).toBe(false);
    expect(/:\s*NVImage\b|<NVImage\b/.test(source)).toBe(false);
    expect(source.includes("NiivueImageLike")).toBe(true);
  });

  it("imports no React, Canvas, DOM or WebGL", () => {
    for (const pattern of [
      /from "react"/,
      /CanvasRenderingContext2D|ImageData|OffscreenCanvas/,
      /\bdocument\.|\bwindow\.|HTMLCanvasElement/,
      /WebGL|webgl/,
    ]) {
      expect(pattern.test(source)).toBe(false);
    }
  });

  it("depends on no renderer or projection code", () => {
    expect(/overlays\/|renderer|projection\//.test(source)).toBe(false);
  });

  it("only the integration test imports Niivue in this adapter area", () => {
    const dir = "src/features/imaging/adapters/niivue";
    const niivueImporters = readdirSync(dir)
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => NIIVUE_IMPORT.test(readFileSync(join(dir, name), "utf8")));
    // niivue-engine (Phase 8B rendering) predates this phase; the only reslice
    // sampler importer of Niivue is the real-volume integration test.
    const reslicaImporters = niivueImporters.filter((name) => name.includes("volume-sampler"));
    expect(reslicaImporters).toEqual(["niivue-volume-sampler.integration.test.ts"]);
  });
});

describe("the adapter satisfies VolumeSampler without changing it", () => {
  const geometry: VolumeGeometry = {
    dimensionsVox: { x: 2, y: 2, z: 2 },
    spacingMm: { x: 1, y: 1, z: 1 },
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } },
    center: { x: 1, y: 1, z: 1 },
    obliquity: { angleDeg: 0, maxShearDeg: 0 },
    coordinateSystem: "niivue-ortho-mm",
  };
  const image: NiivueImageLike = {
    frac2mmOrtho: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    getValue: () => 0,
  };

  it("produces an object matching the VolumeSampler contract", () => {
    const result = createNiivueVolumeSampler({ volumeId: "v", image, geometry });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const sampler = result.sampler;
    expect(typeof sampler.volumeId).toBe("string");
    expect(sampler.dimensions).toHaveLength(3);
    expect(typeof sampler.worldToVoxel).toBe("function");
    expect(typeof sampler.getVoxel).toBe("function");
  });
});
