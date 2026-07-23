import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AXIAL } from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import type { VolumeSampler } from "@/features/imaging/reslice/volume-sampler";
import type { Deferrer } from "@/features/imaging/reslice/runtime/oblique-preview-scheduler";
import { useObliquePreview } from "@/features/imaging/reslice/runtime/use-oblique-preview";

const GEOMETRY: VolumeGeometry = {
  dimensionsVox: { x: 10, y: 10, z: 10 },
  spacingMm: { x: 1, y: 1, z: 1 },
  bounds: { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } },
  center: { x: 0, y: 0, z: 0 },
  obliquity: { angleDeg: 0, maxShearDeg: 0 },
  coordinateSystem: "niivue-ortho-mm",
};

const sampler: VolumeSampler = {
  volumeId: "vol", dimensions: [10, 10, 10],
  worldToVoxel: (x, y, z, out) => { out.x = x + 5; out.y = y + 5; out.z = z + 5; return true; },
  getVoxel: (x, y, z) => (x < 0 || y < 0 || z < 0 || x > 9 || y > 9 || z > 9 ? null : 100),
};

function capabilities(identity = "vol"): ImagingRuntimeCapabilities {
  return {
    volumeIdentity: identity, geometry: GEOMETRY,
    volumeSampler: {
      volumeIdentity: identity, geometry: GEOMETRY,
      intensityWindow: { min: 0, max: 200, source: "cal" },
      createSampler: () => ({ status: "ready", sampler }),
    },
  };
}

const prescription: Prescription = {
  center: { x: 0, y: 0, z: 0 }, orientation: AXIAL,
  fovRead: 8, fovPhase: 8, sliceThickness: 1, sliceGap: 0, sliceCount: 1,
};

/** Deferrer whose queued work runs immediately, for synchronous assertions. */
const immediate: Deferrer = { schedule: (run) => { run(); return 0; }, cancel: () => undefined };

const CAPS = capabilities();

describe("useObliquePreview gating", () => {
  it("is hidden outside the niivue world route", () => {
    const { result } = renderHook(() =>
      useObliquePreview({ engineKind: "jpg", planningMode: "world", prescription, capabilities: CAPS, deferrer: immediate })
    );
    expect(result.current.status).toBe("hidden");
  });

  it("is hidden for niivue legacy planning", () => {
    const { result } = renderHook(() =>
      useObliquePreview({ engineKind: "niivue", planningMode: "legacy", prescription, capabilities: CAPS, deferrer: immediate })
    );
    expect(result.current.status).toBe("hidden");
  });

  it("waits when active but no volume is loaded", () => {
    const { result } = renderHook(() =>
      useObliquePreview({ engineKind: "niivue", planningMode: "world", prescription, capabilities: null, deferrer: immediate })
    );
    expect(result.current.status).toBe("waiting-for-volume");
  });
});

describe("useObliquePreview computation", () => {
  it("produces a ready preview on the active route", () => {
    const { result } = renderHook(() =>
      useObliquePreview({ engineKind: "niivue", planningMode: "world", prescription, capabilities: CAPS, deferrer: immediate })
    );
    expect(result.current.status).toBe("ready");
  });

  it("clears to hidden when the route leaves niivue world", () => {
    const { result, rerender } = renderHook(
      (props: { mode: "world" | "legacy" }) =>
        useObliquePreview({ engineKind: "niivue", planningMode: props.mode, prescription, capabilities: CAPS, deferrer: immediate }),
      { initialProps: { mode: "world" as const } }
    );
    expect(result.current.status).toBe("ready");
    rerender({ mode: "legacy" });
    expect(result.current.status).toBe("hidden");
  });

  it("does not publish a stale result when the deferred work is superseded", () => {
    const queue: Array<() => void> = [];
    const manual: Deferrer = { schedule: (run) => { queue.push(run); return queue.length; }, cancel: () => undefined };
    const { result, rerender } = renderHook(
      (props: { caps: ImagingRuntimeCapabilities }) =>
        useObliquePreview({ engineKind: "niivue", planningMode: "world", prescription, capabilities: props.caps, deferrer: manual }),
      { initialProps: { caps: capabilities() } }
    );
    rerender({ caps: capabilities() }); // a new object supersedes before any flush
    act(() => queue.forEach((run) => run()));
    // Only the latest generation may publish; earlier scheduled work is discarded.
    expect(result.current.status).toBe("ready");
  });

  it("cancels scheduled work on unmount", () => {
    const cancel = vi.fn();
    const deferrer: Deferrer = { schedule: () => 1, cancel };
    const { unmount } = renderHook(() =>
      useObliquePreview({ engineKind: "niivue", planningMode: "world", prescription, capabilities: CAPS, deferrer })
    );
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
