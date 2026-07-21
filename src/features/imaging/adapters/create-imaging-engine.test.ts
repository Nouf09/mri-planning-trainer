import { describe, it, expect } from "vitest";
import { createImagingEngine } from "@/features/imaging/adapters/create-imaging-engine";
import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";

const planes: AnatomicalPlane[] = ["sagittal", "coronal", "axial"];

describe("createImagingEngine", () => {
  it("builds the legacy JPG engine for the 'jpg' kind", () => {
    const engine = createImagingEngine("jpg");
    expect(engine.kind).toBe("jpg");
  });

  it("returns a background source for every plane", () => {
    const engine = createImagingEngine("jpg");
    for (const plane of planes) {
      const source = engine.getBackgroundSource(plane);
      expect(typeof source).toBe("string");
      expect(source).toBeTruthy();
    }
  });

  it("returns a distinct image per plane", () => {
    const engine = createImagingEngine("jpg");
    const sources = planes.map((plane) => engine.getBackgroundSource(plane));
    expect(new Set(sources).size).toBe(planes.length);
  });

  it("exposes a callable dispose", () => {
    const engine = createImagingEngine("jpg");
    expect(() => engine.dispose()).not.toThrow();
  });
});

describe("createImagingEngine fallback", () => {
  it("falls back to the JPG engine for the not-yet-implemented 'niivue' kind", () => {
    const engine = createImagingEngine("niivue");
    expect(engine).toBeDefined();
    expect(engine.kind).toBe("jpg");
  });

  it("falls back to the JPG engine for an unknown kind", () => {
    const engine = createImagingEngine("bogus" as ImagingEngineKind);
    expect(engine.kind).toBe("jpg");
  });

  it("still renders backgrounds when falling back", () => {
    const engine = createImagingEngine("niivue");
    expect(engine.getBackgroundSource("axial")).toBeTruthy();
  });
});
