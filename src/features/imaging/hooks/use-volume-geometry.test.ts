import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { VolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";
import {
  boundsCenter,
  normalizeBounds,
  type VolumeGeometry,
} from "@/features/imaging/domain/volume-geometry";
import { useVolumeGeometry } from "@/features/imaging/hooks/use-volume-geometry";

function makeGeometry(): VolumeGeometry {
  const bounds = normalizeBounds({ x: -90, y: -108, z: -90 }, { x: 90, y: 108, z: 90 });
  return {
    dimensionsVox: { x: 180, y: 216, z: 180 },
    spacingMm: { x: 1, y: 1, z: 1 },
    bounds,
    center: boundsCenter(bounds),
    obliquity: { angleDeg: 0, maxShearDeg: 0 },
    coordinateSystem: "niivue-ortho-mm",
  };
}

function createVolumeEngine(geometry: VolumeGeometry | null = makeGeometry()) {
  const getVolumeGeometry = vi.fn(() => geometry);
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
    navigateToScreenPoint: vi.fn(),
    getVolumeGeometry,
  };
  return engine as unknown as VolumeImagingEngine & {
    getVolumeGeometry: typeof getVolumeGeometry;
  };
}

const jpgEngine: ImagingEngine = {
  kind: "jpg",
  getBackgroundSource: () => "/mri-axial.jpg",
  dispose: () => undefined,
};

describe("useVolumeGeometry", () => {
  it("reads geometry once the volume is ready", () => {
    const engine = createVolumeEngine();
    const { result } = renderHook(() => useVolumeGeometry(engine, "ready"));
    expect(result.current?.coordinateSystem).toBe("niivue-ortho-mm");
    expect(engine.getVolumeGeometry).toHaveBeenCalledTimes(1);
  });

  it("has no geometry before the volume is ready", () => {
    const engine = createVolumeEngine();
    for (const status of ["idle", "loading", "error"] as const) {
      const { result } = renderHook(() => useVolumeGeometry(engine, status));
      expect(result.current).toBeNull();
    }
    expect(engine.getVolumeGeometry).not.toHaveBeenCalled();
  });

  it("has no geometry for an engine that does not render volumes", () => {
    const { result } = renderHook(() => useVolumeGeometry(jpgEngine, "ready"));
    expect(result.current).toBeNull();
  });

  it("reports null when the engine has no geometry to give", () => {
    const engine = createVolumeEngine(null);
    const { result } = renderHook(() => useVolumeGeometry(engine, "ready"));
    expect(result.current).toBeNull();
  });

  it("clears geometry when the volume stops being ready", () => {
    const engine = createVolumeEngine();
    const { result, rerender } = renderHook(
      ({ status }) => useVolumeGeometry(engine, status),
      { initialProps: { status: "ready" as const } }
    );
    expect(result.current).not.toBeNull();

    rerender({ status: "loading" as never });
    expect(result.current).toBeNull();
  });

  it("clears geometry on unmount", () => {
    const engine = createVolumeEngine();
    const { result, unmount } = renderHook(() => useVolumeGeometry(engine, "ready"));
    expect(result.current).not.toBeNull();
    unmount();
    // Nothing is retained that a later render could mistake for live geometry.
    expect(engine.getVolumeGeometry).toHaveBeenCalledTimes(1);
  });

  it("re-reads geometry when the engine is replaced", () => {
    const first = createVolumeEngine();
    const second = createVolumeEngine();
    const { rerender } = renderHook(
      ({ engine }) => useVolumeGeometry(engine, "ready"),
      { initialProps: { engine: first as unknown as ImagingEngine } }
    );
    rerender({ engine: second as unknown as ImagingEngine });

    expect(first.getVolumeGeometry).toHaveBeenCalledTimes(1);
    expect(second.getVolumeGeometry).toHaveBeenCalledTimes(1);
  });
});
