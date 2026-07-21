import { describe, it, expect, vi, afterEach } from "vitest";
import { createImagingEngine } from "@/features/imaging/adapters/create-imaging-engine";
import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";

const planes: AnatomicalPlane[] = ["sagittal", "coronal", "axial"];

const withWebGL2 = (supported: boolean) =>
  vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(supported ? ({} as unknown as RenderingContext) : null);

afterEach(() => {
  vi.restoreAllMocks();
});

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
  it("builds the niivue engine when WebGL2 is available", () => {
    withWebGL2(true);
    expect(createImagingEngine("niivue").kind).toBe("niivue");
  });

  it("falls back to the JPG engine when WebGL2 is unavailable", () => {
    withWebGL2(false);
    const engine = createImagingEngine("niivue");
    expect(engine).toBeDefined();
    expect(engine.kind).toBe("jpg");
  });

  it("falls back to the JPG engine for an unknown kind", () => {
    const engine = createImagingEngine("bogus" as ImagingEngineKind);
    expect(engine.kind).toBe("jpg");
  });

  it("still renders backgrounds when falling back", () => {
    withWebGL2(false);
    const engine = createImagingEngine("niivue");
    expect(engine.getBackgroundSource("axial")).toBeTruthy();
  });

  it("is deterministic for the default engine regardless of WebGL2", () => {
    withWebGL2(false);
    expect(createImagingEngine("jpg").kind).toBe("jpg");
    vi.restoreAllMocks();
    withWebGL2(true);
    expect(createImagingEngine("jpg").kind).toBe("jpg");
  });
});
