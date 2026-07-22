import { describe, it, expect, vi, beforeEach } from "vitest";

const attachToCanvas = vi.fn(async () => undefined);
const loadVolumes = vi.fn(async () => undefined);
const setSliceType = vi.fn();
const cleanup = vi.fn();
const drawScene = vi.fn();
const moveCrosshairInVox = vi.fn();

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
      moveCrosshairInVox,
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
  moveCrosshairInVox.mockClear();
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

describe("niivue engine slice stepping", () => {
  it("steps each plane along its own voxel axis", async () => {
    const cases = [
      ["sagittal", [1, 0, 0]],
      ["coronal", [0, 1, 0]],
      ["axial", [0, 0, 1]],
    ] as const;

    for (const [plane, expected] of cases) {
      moveCrosshairInVox.mockClear();
      const { engine } = await mountedEngine(plane);
      engine.stepSlice(plane, 1);
      expect(moveCrosshairInVox).toHaveBeenCalledWith(...expected);
    }
  });

  it("carries the sign of the step", async () => {
    const { engine } = await mountedEngine("axial");
    engine.stepSlice("axial", -3);
    expect(moveCrosshairInVox).toHaveBeenCalledWith(0, 0, -3);
  });

  it("ignores a zero step", async () => {
    const { engine } = await mountedEngine("axial");
    engine.stepSlice("axial", 0);
    expect(moveCrosshairInVox).not.toHaveBeenCalled();
  });

  it("does nothing before a volume is mounted", () => {
    const engine = createNiivueEngine();
    engine.stepSlice("axial", 1);
    expect(moveCrosshairInVox).not.toHaveBeenCalled();
  });

  it("reports a stepped move as user-driven navigation", async () => {
    const { engine, instance } = await mountedEngine("axial");
    const listener = vi.fn();
    engine.setPositionListener(listener);

    // Niivue reports the move it just made.
    moveCrosshairInVox.mockImplementationOnce(() => {
      instance.onLocationChange({ mm: [3, 4, 5] });
    });
    engine.stepSlice("axial", 1);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ x: 3, y: 4, z: 5 });
  });

  it("does not echo when the shared position returns to it", async () => {
    const { engine, instance } = await mountedEngine("axial");
    const listener = vi.fn();
    engine.setPositionListener(listener);

    moveCrosshairInVox.mockImplementationOnce(() => {
      instance.onLocationChange({ mm: [3, 4, 5] });
    });
    engine.stepSlice("axial", 1);
    engine.setPosition({ x: 3, y: 4, z: 5 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(drawScene).not.toHaveBeenCalled();
  });
});

describe("niivue engine click navigation", () => {
  it("does nothing before a volume is mounted", () => {
    const engine = createNiivueEngine();
    const canvas = makeCanvas();
    const seen: string[] = [];
    canvas.addEventListener("mousedown", () => seen.push("mousedown"));
    canvas.addEventListener("mouseup", () => seen.push("mouseup"));

    expect(() => engine.navigateToScreenPoint(10, 20)).not.toThrow();
    expect(seen).toEqual([]);
  });

  it("dispatches a paired mousedown and mouseup to the engine canvas", async () => {
    const engine = createNiivueEngine();
    const canvas = makeCanvas();
    await engine.mount(canvas, "axial");

    const seen: string[] = [];
    canvas.addEventListener("mousedown", () => seen.push("mousedown"));
    canvas.addEventListener("mouseup", () => seen.push("mouseup"));

    engine.navigateToScreenPoint(120, 240);

    expect(seen).toEqual(["mousedown", "mouseup"]);
  });

  it("preserves the client coordinates exactly", async () => {
    const engine = createNiivueEngine();
    const canvas = makeCanvas();
    await engine.mount(canvas, "axial");

    const points: Array<[number, number]> = [];
    const record = (event: Event) => {
      const mouse = event as MouseEvent;
      points.push([mouse.clientX, mouse.clientY]);
    };
    canvas.addEventListener("mousedown", record);
    canvas.addEventListener("mouseup", record);

    engine.navigateToScreenPoint(137, 411);

    expect(points).toEqual([
      [137, 411],
      [137, 411],
    ]);
  });

  it("does not leave a button held after the click", async () => {
    const engine = createNiivueEngine();
    const canvas = makeCanvas();
    await engine.mount(canvas, "axial");

    const buttons: number[] = [];
    canvas.addEventListener("mousedown", (e) => buttons.push((e as MouseEvent).buttons));
    canvas.addEventListener("mouseup", (e) => buttons.push((e as MouseEvent).buttons));

    engine.navigateToScreenPoint(5, 5);

    expect(buttons).toEqual([1, 0]);
  });

  it("stops dispatching after disposal", async () => {
    const engine = createNiivueEngine();
    const canvas = makeCanvas();
    await engine.mount(canvas, "axial");
    engine.dispose();

    const seen: string[] = [];
    canvas.addEventListener("mousedown", () => seen.push("mousedown"));

    engine.navigateToScreenPoint(1, 1);

    expect(seen).toEqual([]);
  });

  it("publishes a forwarded click exactly once", async () => {
    const { engine, instance } = await mountedEngine("axial");
    const listener = vi.fn();
    engine.setPositionListener(listener);

    engine.navigateToScreenPoint(60, 60);
    // Niivue reports the crosshair move the click produced.
    instance.onLocationChange({ mm: [8, 9, 10] });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ x: 8, y: 9, z: 10 });
  });

  it("never republishes when the shared position returns to it", async () => {
    const { engine, instance } = await mountedEngine("axial");
    const listener = vi.fn();
    engine.setPositionListener(listener);

    engine.navigateToScreenPoint(60, 60);
    instance.onLocationChange({ mm: [8, 9, 10] });
    engine.setPosition({ x: 8, y: 9, z: 10 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(drawScene).not.toHaveBeenCalled();
  });
});

describe("niivue engine volume geometry", () => {
  it("has no geometry before a volume is mounted", () => {
    expect(createNiivueEngine().getVolumeGeometry()).toBeNull();
  });

  it("has no geometry when the volume carries no spatial metadata", async () => {
    const { engine } = await mountedEngine("axial");
    expect(engine.getVolumeGeometry()).toBeNull();
  });

  it("reads the loaded volume's physical geometry", async () => {
    const { engine, instance } = await mountedEngine("axial");
    (instance as unknown as { volumes: unknown[] }).volumes = [
      {
        dimsRAS: [3, 180, 216, 180],
        pixDimsRAS: [1, 1, 1, 1],
        extentsMinOrtho: [-90, -108, -90],
        extentsMaxOrtho: [90, 108, 90],
        oblique_angle: 0,
        maxShearDeg: 0,
      },
    ];

    const geometry = engine.getVolumeGeometry();
    expect(geometry?.coordinateSystem).toBe("niivue-ortho-mm");
    expect(geometry?.dimensionsVox).toEqual({ x: 180, y: 216, z: 180 });
    expect(geometry?.center).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("stops reporting geometry after disposal", async () => {
    const { engine, instance } = await mountedEngine("axial");
    (instance as unknown as { volumes: unknown[] }).volumes = [
      {
        dimsRAS: [3, 2, 2, 2],
        pixDimsRAS: [1, 1, 1, 1],
        extentsMinOrtho: [-1, -1, -1],
        extentsMaxOrtho: [1, 1, 1],
      },
    ];
    expect(engine.getVolumeGeometry()).not.toBeNull();

    engine.dispose();
    expect(engine.getVolumeGeometry()).toBeNull();
  });
});
