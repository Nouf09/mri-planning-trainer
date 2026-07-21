import { describe, it, expect, vi, beforeEach } from "vitest";

const attachToCanvas = vi.fn(async () => undefined);
const loadVolumes = vi.fn(async () => undefined);
const setSliceType = vi.fn();
const cleanup = vi.fn();

// jsdom has no WebGL2, so a real Niivue instance cannot be constructed here.
// The adapter contract is verified against a mock instead.
vi.mock("@niivue/niivue", () => ({
  Niivue: vi.fn(function NiivueMock() {
    return { attachToCanvas, loadVolumes, setSliceType, cleanup };
  }),
  SLICE_TYPE: { AXIAL: 0, CORONAL: 1, SAGITTAL: 2, MULTIPLANAR: 3, RENDER: 4 },
}));

import { createNiivueEngine } from "@/features/imaging/adapters/niivue/niivue-engine";
import { isVolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";

const makeCanvas = () => document.createElement("canvas");
const source = { url: "/volumes/mni152.nii.gz" };

beforeEach(() => {
  attachToCanvas.mockClear();
  loadVolumes.mockClear();
  setSliceType.mockClear();
  cleanup.mockClear();
});

describe("niivue engine identity", () => {
  it("reports the niivue kind and satisfies the volume engine guard", () => {
    const engine = createNiivueEngine();
    expect(engine.kind).toBe("niivue");
    expect(isVolumeImagingEngine(engine)).toBe(true);
  });

  it("provides no background image, since it paints its own canvas", () => {
    expect(createNiivueEngine().getBackgroundSource("axial")).toBeNull();
  });
});

describe("niivue engine mount", () => {
  it("attaches to the canvas once", async () => {
    const engine = createNiivueEngine();
    await engine.mount(makeCanvas(), "axial");
    expect(attachToCanvas).toHaveBeenCalledTimes(1);
  });

  it("does not re-attach when mounted twice on the same canvas", async () => {
    const engine = createNiivueEngine();
    const canvas = makeCanvas();
    await engine.mount(canvas, "axial");
    await engine.mount(canvas, "axial");
    expect(attachToCanvas).toHaveBeenCalledTimes(1);
  });

  it("fixes the slice type for each plane", async () => {
    const planes = [
      ["axial", 0],
      ["coronal", 1],
      ["sagittal", 2],
    ] as const;
    for (const [plane, expected] of planes) {
      setSliceType.mockClear();
      const engine = createNiivueEngine();
      await engine.mount(makeCanvas(), plane);
      expect(setSliceType).toHaveBeenCalledWith(expected);
    }
  });

  it("re-attaches after disposal, so a Strict Mode remount works", async () => {
    const engine = createNiivueEngine();
    const canvas = makeCanvas();
    await engine.mount(canvas, "axial");
    engine.dispose();
    await engine.mount(canvas, "axial");
    expect(attachToCanvas).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("niivue engine volume loading", () => {
  it("loads the configured volume url", async () => {
    const engine = createNiivueEngine();
    await engine.mount(makeCanvas(), "axial");
    await engine.loadVolume(source);
    expect(loadVolumes).toHaveBeenCalledWith([{ url: source.url }]);
  });

  it("does nothing when no instance is mounted", async () => {
    const engine = createNiivueEngine();
    await engine.loadVolume(source);
    expect(loadVolumes).not.toHaveBeenCalled();
  });

  it("propagates load failures so callers can surface an error", async () => {
    loadVolumes.mockRejectedValueOnce(new Error("bad volume"));
    const engine = createNiivueEngine();
    await engine.mount(makeCanvas(), "axial");
    await expect(engine.loadVolume(source)).rejects.toThrow("bad volume");
  });
});

describe("niivue engine disposal", () => {
  it("cleans up the instance", async () => {
    const engine = createNiivueEngine();
    await engine.mount(makeCanvas(), "axial");
    engine.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("is idempotent", async () => {
    const engine = createNiivueEngine();
    await engine.mount(makeCanvas(), "axial");
    engine.dispose();
    engine.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("is safe before any mount", () => {
    const engine = createNiivueEngine();
    expect(() => engine.dispose()).not.toThrow();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("abandons a mount that is disposed before the library resolves", async () => {
    const engine = createNiivueEngine();
    const mounting = engine.mount(makeCanvas(), "axial");
    engine.dispose();
    await mounting;

    // Nothing was attached, and no instance is retained afterwards.
    expect(attachToCanvas).not.toHaveBeenCalled();
    await engine.loadVolume(source);
    expect(loadVolumes).not.toHaveBeenCalled();
  });

  it("cleans up an instance that finishes attaching after disposal", async () => {
    let finishAttach: () => void = () => undefined;
    attachToCanvas.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => {
        finishAttach = () => resolve(undefined);
      })
    );

    const engine = createNiivueEngine();
    const mounting = engine.mount(makeCanvas(), "axial");
    // Let the lazy import settle so the pending attach is reached.
    await new Promise((resolve) => setTimeout(resolve, 0));

    engine.dispose();
    finishAttach();
    await mounting;

    // The orphaned instance is released rather than leaked.
    expect(cleanup).toHaveBeenCalledTimes(1);
    await engine.loadVolume(source);
    expect(loadVolumes).not.toHaveBeenCalled();
  });

  it("does not throw when cleanup itself fails", async () => {
    cleanup.mockImplementationOnce(() => {
      throw new Error("cleanup failed");
    });
    const engine = createNiivueEngine();
    await engine.mount(makeCanvas(), "axial");
    expect(() => engine.dispose()).not.toThrow();
  });
});
