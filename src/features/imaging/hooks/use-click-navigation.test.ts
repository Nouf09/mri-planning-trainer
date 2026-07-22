import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, renderHook, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { VolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";
import { useClickNavigation } from "@/features/imaging/hooks/use-click-navigation";

// Stands in for Niivue: reports a location change whenever its canvas is
// clicked, which is what the real library does after converting the screen
// coordinate itself.
vi.mock("@niivue/niivue", () => ({
  Niivue: vi.fn(function NiivueMock(this: Record<string, unknown>) {
    const self: Record<string, unknown> = {
      attachToCanvas: async (canvas: HTMLCanvasElement) => {
        canvas.addEventListener("mousedown", (event) => {
          const mouse = event as MouseEvent;
          (self.onLocationChange as (l: unknown) => void)({
            mm: [mouse.clientX, mouse.clientY, 0],
          });
        });
      },
      loadVolumes: async () => undefined,
      setSliceType: () => undefined,
      cleanup: () => undefined,
      drawScene: () => undefined,
      moveCrosshairInVox: () => undefined,
      mm2frac: (mm: number[]) => [mm[0] / 100, mm[1] / 100, mm[2] / 100],
      frac2mm: (frac: number[]) => [frac[0] * 100, frac[1] * 100, frac[2] * 100, 1],
      scene: { crosshairPos: [0.5, 0.5, 0.5] },
      onLocationChange: () => undefined,
    };
    return self;
  }),
  SLICE_TYPE: { AXIAL: 0, CORONAL: 1, SAGITTAL: 2, MULTIPLANAR: 3, RENDER: 4 },
}));

import { MedicalViewport } from "@/components/MedicalViewport";
import { useVolumePosition } from "@/features/imaging/hooks/use-volume-position";
import { defaultParams } from "@/features/planning/state/planning.initial-state";
import { toPlanningSession } from "@/features/planning/domain/planning-session";
import { BRAIN_SYNTHETIC_WORLD } from "@/features/imaging/data/brain-synthetic-world";
import {
  DEFAULT_SEQUENCE_ID,
  EDUCATIONAL_PATIENT,
  EDUCATIONAL_STUDY,
} from "@/features/planning/data/educational-session";

const planningSession = toPlanningSession({
  patient: EDUCATIONAL_PATIENT,
  study: EDUCATIONAL_STUDY,
  sequenceId: DEFAULT_SEQUENCE_ID,
  protocolName: "T1 MPRAGE",
  world: BRAIN_SYNTHETIC_WORLD,
  centerX: 0.5,
  centerY: 0.5,
  angulation: defaultParams.angulation,
  fovRead: defaultParams.fovRead,
  fovPhase: defaultParams.fovPhase,
  sliceThickness: defaultParams.sliceThickness,
  sliceGap: defaultParams.sliceGap,
  sliceCount: defaultParams.sliceCount,
});

const jpgEngine: ImagingEngine = {
  kind: "jpg",
  getBackgroundSource: () => "/mri-axial.jpg",
  dispose: () => undefined,
};

function createVolumeEngine() {
  const navigateToScreenPoint = vi.fn();
  const engine = {
    kind: "niivue" as const,
    getBackgroundSource: () => null,
    dispose: vi.fn(),
    mount: vi.fn(async () => undefined),
    loadVolume: vi.fn(async () => undefined),
    setPosition: vi.fn(),
    setPositionListener: vi.fn(),
    getPosition: () => null,
    getCenterPosition: () => null,
    stepSlice: vi.fn(),
    navigateToScreenPoint,
  };
  return engine as unknown as VolumeImagingEngine & {
    navigateToScreenPoint: typeof navigateToScreenPoint;
  };
}

describe("useClickNavigation guards", () => {
  it("forwards the exact client coordinates when ready", () => {
    const engine = createVolumeEngine();
    const { result } = renderHook(() => useClickNavigation({ engine, status: "ready" }));

    result.current(321, 654);

    expect(engine.navigateToScreenPoint).toHaveBeenCalledWith(321, 654);
  });

  it("does nothing for an engine that does not render volumes", () => {
    const { result } = renderHook(() => useClickNavigation({ engine: jpgEngine, status: "ready" }));
    expect(() => result.current(10, 10)).not.toThrow();
  });

  it("does nothing while the volume is not ready", () => {
    const engine = createVolumeEngine();
    const { result } = renderHook(() => useClickNavigation({ engine, status: "loading" }));

    result.current(10, 10);

    expect(engine.navigateToScreenPoint).not.toHaveBeenCalled();
  });

  it("does nothing when the volume failed to load", () => {
    const engine = createVolumeEngine();
    const { result } = renderHook(() => useClickNavigation({ engine, status: "error" }));

    result.current(10, 10);

    expect(engine.navigateToScreenPoint).not.toHaveBeenCalled();
  });
});

describe("click navigation inside a viewport", () => {
  const VIEWPORT_SIZE = 500;

  beforeEach(() => {
    window.history.pushState({}, "", "/?engine=niivue");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type: string) =>
      type === "webgl2" ? ({} as unknown as RenderingContext) : null
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: VIEWPORT_SIZE, bottom: VIEWPORT_SIZE,
      width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
  });

  function Harness() {
    const { position, publishPosition } = useVolumePosition();
    return createElement(MedicalViewport, {
      label: "axial",
      plane: "axial",
      params: defaultParams,
      planning: { centerX: 0.5, centerY: 0.5 },
      onPlanningChange: () => undefined,
      onParamChange: () => undefined,
      volumePosition: position,
      onVolumePositionChange: publishPosition,
      session: planningSession,
    });
  }

  /** Each viewport renders the engine canvas first, then the overlay canvas. */
  async function renderViewports() {
    const view = render(createElement(Harness));
    // Navigation is deliberately inert until the volume is ready.
    await waitFor(() => {
      expect(view.queryAllByText("LOADING VOLUME")).toHaveLength(0);
      expect(view.queryAllByText("VOLUME UNAVAILABLE")).toHaveLength(0);
    });
    // The engine canvas renders first, the overlay canvas last.
    const canvases = Array.from(view.container.querySelectorAll("canvas"));
    return { view, engineCanvas: canvases[0], overlayCanvas: canvases[canvases.length - 1] };
  }

  it("navigates when the click misses every planning handle", async () => {
    const { engineCanvas, overlayCanvas } = await renderViewports();
    const received: number[] = [];
    engineCanvas.addEventListener("mousedown", (e) => received.push((e as MouseEvent).clientX));

    fireEvent.mouseDown(overlayCanvas, { clientX: 5, clientY: 5 });

    expect(received).toEqual([5]);
  });

  it("never navigates when the click lands on a planning handle", async () => {
    const { engineCanvas, overlayCanvas } = await renderViewports();
    const received: number[] = [];
    engineCanvas.addEventListener("mousedown", () => received.push(1));

    // The prescription centre is a "move" handle.
    fireEvent.mouseDown(overlayCanvas, {
      clientX: VIEWPORT_SIZE / 2,
      clientY: VIEWPORT_SIZE / 2,
    });

    expect(received).toEqual([]);
  });

  it("navigates using the exact click coordinates", async () => {
    const { engineCanvas, overlayCanvas } = await renderViewports();
    const points: Array<[number, number]> = [];
    engineCanvas.addEventListener("mousedown", (e) => {
      const mouse = e as MouseEvent;
      points.push([mouse.clientX, mouse.clientY]);
    });

    fireEvent.mouseDown(overlayCanvas, { clientX: 17, clientY: 23 });

    expect(points).toEqual([[17, 23]]);
  });
});

describe("click navigation across three viewports", () => {
  /** Fake engines keep three-viewport behaviour deterministic. */
  function renderThree() {
    const engines = [createVolumeEngine(), createVolumeEngine(), createVolumeEngine()];
    const { result } = renderHook(() => ({
      a: useClickNavigation({ engine: engines[0], status: "ready" }),
      b: useClickNavigation({ engine: engines[1], status: "ready" }),
      c: useClickNavigation({ engine: engines[2], status: "ready" }),
    }));
    return { engines, result };
  }

  it("routes a click to exactly one engine, never viewport to viewport", () => {
    const { engines, result } = renderThree();

    result.current.b(40, 50);

    expect(engines[0].navigateToScreenPoint).not.toHaveBeenCalled();
    expect(engines[1].navigateToScreenPoint).toHaveBeenCalledTimes(1);
    expect(engines[2].navigateToScreenPoint).not.toHaveBeenCalled();
  });

  it("keeps forwarding bounded when the same point is clicked repeatedly", () => {
    const { engines, result } = renderThree();

    result.current.c(12, 12);
    result.current.c(12, 12);

    expect(engines[2].navigateToScreenPoint).toHaveBeenCalledTimes(2);
    expect(engines[0].navigateToScreenPoint).not.toHaveBeenCalled();
    expect(engines[1].navigateToScreenPoint).not.toHaveBeenCalled();
  });
});
