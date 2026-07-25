import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AXIAL } from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import type { VolumeSampler } from "@/features/imaging/reslice/volume-sampler";
import type { Deferrer } from "@/features/imaging/reslice/runtime/oblique-preview-scheduler";
import { useObliqueStack } from "@/features/imaging/reslice/runtime/use-oblique-stack";

const GEOMETRY: VolumeGeometry = {
  dimensionsVox: { x: 20, y: 20, z: 20 }, spacingMm: { x: 1, y: 1, z: 1 },
  bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } },
  center: { x: 0, y: 0, z: 0 }, obliquity: { angleDeg: 0, maxShearDeg: 0 }, coordinateSystem: "niivue-ortho-mm",
};
const getVoxel = vi.fn((x: number, y: number, z: number) => (x < 0 || y < 0 || z < 0 || x > 19 || y > 19 || z > 19 ? null : x + y * 20 + z * 400));
const sampler: VolumeSampler = {
  volumeId: "vol", dimensions: [20, 20, 20],
  worldToVoxel: (x, y, z, out) => { out.x = x + 10; out.y = y + 10; out.z = z + 10; return true; },
  getVoxel,
};
function samplerFor(identity: string): VolumeSampler {
  return { ...sampler, volumeId: identity };
}
function capabilities(identity = "vol"): ImagingRuntimeCapabilities {
  return { volumeIdentity: identity, geometry: GEOMETRY,
    volumeSampler: { volumeIdentity: identity, geometry: GEOMETRY, intensityWindow: { min: 0, max: 8000, source: "cal" }, createSampler: () => ({ status: "ready", sampler: samplerFor(identity) }) } };
}
const prescription: Prescription = { center: { x: 0, y: 0, z: 0 }, orientation: AXIAL, fovRead: 10, fovPhase: 10, sliceThickness: 3, sliceGap: 1, sliceCount: 5 };
const immediate: Deferrer = { schedule: (run) => { run(); return 0; }, cancel: () => undefined };
const CAPS = capabilities();

function mount(props: { prescription: Prescription; caps: ImagingRuntimeCapabilities }) {
  return renderHook(
    (p: { prescription: Prescription; caps: ImagingRuntimeCapabilities }) =>
      useObliqueStack({ engineKind: "niivue", planningMode: "world", prescription: p.prescription, capabilities: p.caps, deferrer: immediate }),
    { initialProps: props }
  );
}

describe("stack gating", () => {
  it("is hidden outside niivue world", () => {
    const { result } = renderHook(() => useObliqueStack({ engineKind: "jpg", planningMode: "world", prescription, capabilities: CAPS, deferrer: immediate }));
    expect(result.current.state.status).toBe("hidden");
  });
  it("waits without a volume", () => {
    const { result } = renderHook(() => useObliqueStack({ engineKind: "niivue", planningMode: "world", prescription, capabilities: null, deferrer: immediate }));
    expect(result.current.state.status).toBe("waiting-for-volume");
  });
});

describe("stack ready + default selection", () => {
  it("defaults to the centre slice", () => {
    const { result } = mount({ prescription, caps: CAPS });
    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status !== "ready") return;
    expect(result.current.state.sliceCount).toBe(5);
    expect(result.current.state.selectedIndex).toBe(2); // floor(5/2)
  });

  it("reports the centre slice at offset 0 mm", () => {
    const { result } = mount({ prescription, caps: CAPS });
    // thickness 3 + gap 1 -> spacing 4 -> offsets [-8, -4, 0, 4, 8]
    expect((result.current.state as { offsetMm: number }).offsetMm).toBe(0);
  });

  it("names the anatomical direction a positive offset advances along", () => {
    const { result } = mount({ prescription, caps: CAPS });
    // The AXIAL normal is +z, which is superior in the RAS-ordered world space.
    expect((result.current.state as { offsetDirection: { code: string } }).offsetDirection).toEqual({
      code: "S",
      description: "Superior",
    });
  });

  it("keeps the direction while browsing, since the normal is fixed per stack", () => {
    const { result } = mount({ prescription, caps: CAPS });
    act(() => result.current.selectSlice(0));
    const first = (result.current.state as { offsetDirection: unknown }).offsetDirection;
    act(() => result.current.selectSlice(4));
    expect((result.current.state as { offsetDirection: unknown }).offsetDirection).toEqual(first);
  });

  it("updates the offset from the descriptor when the selection changes", () => {
    const { result } = mount({ prescription, caps: CAPS });
    act(() => result.current.selectSlice(4));
    expect((result.current.state as { offsetMm: number }).offsetMm).toBe(8);
    act(() => result.current.selectSlice(0));
    expect((result.current.state as { offsetMm: number }).offsetMm).toBe(-8);
    act(() => result.current.selectSlice(0)); // cached revisit keeps the offset
    expect((result.current.state as { offsetMm: number }).offsetMm).toBe(-8);
  });
});

describe("navigation changes only the index", () => {
  it("selects another slice, clamped", () => {
    const { result } = mount({ prescription, caps: CAPS });
    act(() => result.current.selectSlice(4));
    expect((result.current.state as { selectedIndex: number }).selectedIndex).toBe(4);
    act(() => result.current.selectSlice(99));
    expect((result.current.state as { selectedIndex: number }).selectedIndex).toBe(4);
    act(() => result.current.selectSlice(-3));
    expect((result.current.state as { selectedIndex: number }).selectedIndex).toBe(0);
  });

  it("does not resample a revisited cached slice", () => {
    const { result } = mount({ prescription, caps: CAPS });
    act(() => result.current.selectSlice(0));
    getVoxel.mockClear();
    act(() => result.current.selectSlice(0)); // revisit cached
    expect(getVoxel).not.toHaveBeenCalled();
    expect((result.current.state as { fromCache: boolean }).fromCache).toBe(true);
  });

  it("does not rebuild geometry when only the index changes", () => {
    const createSampler = vi.fn(() => ({ status: "ready" as const, sampler }));
    const caps: ImagingRuntimeCapabilities = { volumeIdentity: "vol", geometry: GEOMETRY, volumeSampler: { volumeIdentity: "vol", geometry: GEOMETRY, intensityWindow: { min: 0, max: 8000, source: "cal" }, createSampler } };
    const { result } = mount({ prescription, caps });
    const before = createSampler.mock.calls.length;
    act(() => result.current.selectSlice(1));
    act(() => result.current.selectSlice(3));
    expect(createSampler.mock.calls.length).toBe(before); // no descriptor rebuild
  });
});

describe("cache invalidation", () => {
  it("invalidates cached slices when the prescription changes", () => {
    const { result, rerender } = mount({ prescription, caps: CAPS });
    act(() => result.current.selectSlice(1));
    getVoxel.mockClear();
    rerender({ prescription: { ...prescription, sliceThickness: 5 }, caps: CAPS });
    // New descriptor: centre reselected and resliced afresh.
    expect(getVoxel).toHaveBeenCalled();
  });

  it("invalidates when the volume identity changes", () => {
    const { result, rerender } = mount({ prescription, caps: capabilities("first") });
    act(() => result.current.selectSlice(1));
    getVoxel.mockClear();
    rerender({ prescription, caps: capabilities("second") });
    expect(getVoxel).toHaveBeenCalled();
  });
});

describe("stale render protection", () => {
  it("does not let a stale queued render publish over a newer selection", () => {
    const queue: Array<() => void> = [];
    const manual: Deferrer = { schedule: (run) => { queue.push(run); return queue.length; }, cancel: () => undefined };
    const { result } = renderHook(() => useObliqueStack({ engineKind: "niivue", planningMode: "world", prescription, capabilities: CAPS, deferrer: manual }));
    act(() => result.current.selectSlice(0));
    act(() => result.current.selectSlice(4)); // supersede
    act(() => queue.forEach((run) => run()));
    expect((result.current.state as { selectedIndex: number }).selectedIndex).toBe(4);
  });
});

describe("unsupported source", () => {
  it("shows unsupported and paints nothing", () => {
    const caps: ImagingRuntimeCapabilities = { volumeIdentity: "vol", geometry: GEOMETRY,
      volumeSampler: { volumeIdentity: "vol", geometry: GEOMETRY, intensityWindow: { min: 0, max: 1, source: "cal" }, createSampler: () => ({ status: "unsupported", reason: "source-volume-shear", measuredShearDeg: 1, maximumSupportedShearDeg: 0.1 }) } };
    const { result } = mount({ prescription, caps });
    expect(result.current.state.status).toBe("unsupported");
  });
});
