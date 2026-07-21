import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { VolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";
import { WHEEL_STEP_THRESHOLD_PX } from "@/features/imaging/domain/slice-navigation";
import { useSliceNavigation } from "@/features/imaging/hooks/use-slice-navigation";

function createFakeEngine() {
  const stepSlice = vi.fn();
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
    stepSlice,
  };
  return engine as unknown as VolumeImagingEngine & { stepSlice: typeof stepSlice };
}

const jpgEngine: ImagingEngine = {
  kind: "jpg",
  getBackgroundSource: () => "/mri-axial.jpg",
  dispose: () => undefined,
};

function makeTarget(): RefObject<HTMLElement> {
  return { current: document.createElement("canvas") } as RefObject<HTMLElement>;
}

function wheel(deltaY: number, deltaMode = 0) {
  return new WheelEvent("wheel", { deltaY, deltaMode, cancelable: true, bubbles: true });
}

function mount(
  engine: ImagingEngine,
  target: RefObject<HTMLElement>,
  status: "idle" | "loading" | "ready" | "error" = "ready",
  plane: "axial" | "coronal" | "sagittal" = "axial"
) {
  return renderHook(() => useSliceNavigation({ engine, status, plane, targetRef: target }));
}

describe("useSliceNavigation input forwarding", () => {
  it("steps a slice once a full threshold is scrolled", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target);

    target.current?.dispatchEvent(wheel(-WHEEL_STEP_THRESHOLD_PX));

    expect(engine.stepSlice).toHaveBeenCalledWith("axial", 1);
  });

  it("steps backwards when scrolling the other way", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target);

    target.current?.dispatchEvent(wheel(WHEEL_STEP_THRESHOLD_PX));

    expect(engine.stepSlice).toHaveBeenCalledWith("axial", -1);
  });

  it("forwards the viewport's own plane", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target, "ready", "coronal");

    target.current?.dispatchEvent(wheel(-WHEEL_STEP_THRESHOLD_PX));

    expect(engine.stepSlice).toHaveBeenCalledWith("coronal", 1);
  });

  it("prevents the page from scrolling behind the viewport", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target);

    const event = wheel(-WHEEL_STEP_THRESHOLD_PX);
    target.current?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores movement below the threshold", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target);

    target.current?.dispatchEvent(wheel(-10));

    expect(engine.stepSlice).not.toHaveBeenCalled();
  });

  it("accumulates small trackpad deltas into a single step", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target);

    for (let i = 0; i < 10; i++) target.current?.dispatchEvent(wheel(-10));

    expect(engine.stepSlice).toHaveBeenCalledTimes(1);
    expect(engine.stepSlice).toHaveBeenCalledWith("axial", 1);
  });

  it("converts line-mode wheel events", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target);

    // 7 lines x 16px exceeds the 100px threshold.
    target.current?.dispatchEvent(wheel(-7, 1));

    expect(engine.stepSlice).toHaveBeenCalledWith("axial", 1);
  });
});

describe("useSliceNavigation guards", () => {
  it("does nothing for an engine that does not render volumes", () => {
    const target = makeTarget();
    mount(jpgEngine, target);

    const event = wheel(-WHEEL_STEP_THRESHOLD_PX);
    target.current?.dispatchEvent(event);

    // No listener attached, so the page keeps its default scroll behaviour.
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing until the volume is ready", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    mount(engine, target, "loading");

    target.current?.dispatchEvent(wheel(-WHEEL_STEP_THRESHOLD_PX));

    expect(engine.stepSlice).not.toHaveBeenCalled();
  });

  it("stops forwarding after unmount", () => {
    const engine = createFakeEngine();
    const target = makeTarget();
    const { unmount } = mount(engine, target);
    unmount();

    target.current?.dispatchEvent(wheel(-WHEEL_STEP_THRESHOLD_PX));

    expect(engine.stepSlice).not.toHaveBeenCalled();
  });
});
