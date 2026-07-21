import { describe, it, expect, vi, beforeEach } from "vitest";

const attachToCanvas = vi.fn(async () => undefined);
const loadVolumes = vi.fn(async () => undefined);
const setSliceType = vi.fn();
const cleanup = vi.fn();
const drawScene = vi.fn();

// A deliberately simple coordinate model: mm = frac * 100. Enough to prove the
// adapter converts in both directions without depending on real Niivue maths.
const mm2frac = vi.fn((mm: [number, number, number]) => [mm[0] / 100, mm[1] / 100, mm[2] / 100]);
const frac2mm = vi.fn((frac: [number, number, number]) => [frac[0] * 100, frac[1] * 100, frac[2] * 100, 1]);

interface MockInstance {
  scene: { crosshairPos: ArrayLike<number> };
  onLocationChange: (location: unknown) => void;
}

let mockInstance: MockInstance;

// jsdom has no WebGL2, so a real Niivue instance cannot be constructed here.
// The adapter contract is verified against a mock instead.
vi.mock("@niivue/niivue", () => ({
  Niivue: vi.fn(function NiivueMock() {
    mockInstance = {
      attachToCanvas,
      loadVolumes,
      setSliceType,
      cleanup,
      drawScene,
      mm2frac,
      frac2mm,
      scene: { crosshairPos: [0.5, 0.5, 0.5] },
      onLocationChange: () => undefined,
    } as unknown as MockInstance;
    return mockInstance;
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
  drawScene.mockClear();
  mm2frac.mockClear();
  frac2mm.mockClear();
});

/** Mounts an engine and returns it together with its mock instance. */
async function mountedEngine(plane: "axial" | "coronal" | "sagittal" = "axial") {
  const engine = createNiivueEngine();
  await engine.mount(makeCanvas(), plane);
  return { engine, instance: mockInstance };
}

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

describe("niivue engine position reporting", () => {
  it("returns no position before a volume is mounted", () => {
    const engine = createNiivueEngine();
    expect(engine.getPosition()).toBeNull();
    expect(engine.getCenterPosition()).toBeNull();
  });

  it("derives the centre from the volume rather than a Niivue default", async () => {
    const { engine } = await mountedEngine();
    expect(engine.getCenterPosition()).toEqual({ x: 50, y: 50, z: 50 });
    expect(frac2mm).toHaveBeenCalledWith([0.5, 0.5, 0.5]);
  });

  it("publishes user-driven location changes as plain millimetre positions", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);

    instance.onLocationChange({ mm: [12, -34, 56], frac: [0, 0, 0], vox: [0, 0, 0] });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ x: 12, y: -34, z: 56 });
  });

  it("ignores location payloads without usable millimetre data", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);

    instance.onLocationChange(null);
    instance.onLocationChange({});
    instance.onLocationChange({ mm: [1, 2] });

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops publishing once the listener is cleared", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);
    engine.setPositionListener(null);

    instance.onLocationChange({ mm: [1, 2, 3] });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("niivue engine position application", () => {
  it("converts millimetres to fractional coordinates and redraws", async () => {
    const { engine, instance } = await mountedEngine();

    engine.setPosition({ x: 20, y: 40, z: 60 });

    expect(mm2frac).toHaveBeenCalledWith([20, 40, 60]);
    expect(instance.scene.crosshairPos).toEqual([0.2, 0.4, 0.6]);
    expect(drawScene).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a mounted instance", () => {
    const engine = createNiivueEngine();
    engine.setPosition({ x: 1, y: 2, z: 3 });
    expect(drawScene).not.toHaveBeenCalled();
  });

  it("skips redundant writes for an unchanged position", async () => {
    const { engine } = await mountedEngine();

    engine.setPosition({ x: 10, y: 10, z: 10 });
    engine.setPosition({ x: 10, y: 10, z: 10 });

    expect(drawScene).toHaveBeenCalledTimes(1);
  });

  it("treats sub-epsilon movement as unchanged", async () => {
    const { engine } = await mountedEngine();

    engine.setPosition({ x: 10, y: 10, z: 10 });
    engine.setPosition({ x: 10.0000001, y: 10, z: 10 });

    expect(drawScene).toHaveBeenCalledTimes(1);
  });
});

describe("niivue engine feedback-loop invariant", () => {
  it("never publishes a position that was applied programmatically", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);

    // Niivue echoes the crosshair change synchronously while it is applied.
    drawScene.mockImplementationOnce(() => {
      instance.onLocationChange({ mm: [70, 80, 90] });
    });

    engine.setPosition({ x: 70, y: 80, z: 90 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("never publishes an asynchronous echo of an applied position", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);

    engine.setPosition({ x: 70, y: 80, z: 90 });
    // Arrives after the applying window has closed.
    instance.onLocationChange({ mm: [70, 80, 90] });

    expect(listener).not.toHaveBeenCalled();
  });

  it("terminates: a user change then its echo produce exactly one publish", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);

    // User moves the crosshair.
    instance.onLocationChange({ mm: [5, 6, 7] });
    // Shared state flows back to this same viewport.
    engine.setPosition({ x: 5, y: 6, z: 7 });
    // Any further echo of that value is silent.
    instance.onLocationChange({ mm: [5, 6, 7] });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(drawScene).not.toHaveBeenCalled();
  });

  it("still publishes genuinely new user movement after an applied position", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);

    engine.setPosition({ x: 1, y: 1, z: 1 });
    instance.onLocationChange({ mm: [2, 2, 2] });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ x: 2, y: 2, z: 2 });
  });

  it("detaches the location callback on dispose", async () => {
    const { engine, instance } = await mountedEngine();
    const listener = vi.fn();
    engine.setPositionListener(listener);
    engine.dispose();

    instance.onLocationChange({ mm: [1, 2, 3] });

    expect(listener).not.toHaveBeenCalled();
  });
});
