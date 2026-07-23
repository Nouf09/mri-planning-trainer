import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, waitFor, cleanup } from "@testing-library/react";

// Enriched Niivue mock: loadVolumes populates a volume with the fields the
// capability builder needs, so a real capability can be produced.
const attachToCanvas = vi.fn(async () => undefined);
vi.mock("@niivue/niivue", () => ({
  Niivue: vi.fn(function NiivueMock(this: Record<string, unknown>) {
    const self: Record<string, unknown> = {
      attachToCanvas,
      loadVolumes: async () => {
        self.volumes = [{
          frac2mmOrtho: [6, 0, 0, 0, 0, 8, 0, 0, 0, 0, 10, 0, -11, -21, -31, 1],
          getValue: () => 0,
          dimsRAS: [3, 3, 4, 5],
          pixDimsRAS: [1, 2, 2, 2],
          extentsMinOrtho: [-11, -21, -31],
          extentsMaxOrtho: [7, 11, 19],
          oblique_angle: 0,
          maxShearDeg: 0,
          global_min: 0,
          global_max: 1000,
        }];
      },
      setSliceType: () => undefined,
      cleanup: () => undefined,
      drawScene: () => undefined,
      moveCrosshairInVox: () => undefined,
      mm2frac: () => [0.5, 0.5, 0.5],
      frac2mm: () => [0, 0, 0, 1],
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
import { boundsFromDescriptor } from "@/features/imaging/domain/volume-geometry";
import { DEFAULT_SEQUENCE_ID, EDUCATIONAL_PATIENT, EDUCATIONAL_STUDY } from "@/features/planning/data/educational-session";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";

const BOUNDS = boundsFromDescriptor(BRAIN_SYNTHETIC_WORLD);
const session = toPlanningSession({
  patient: EDUCATIONAL_PATIENT, study: EDUCATIONAL_STUDY, sequenceId: DEFAULT_SEQUENCE_ID,
  protocolName: "T1 MPRAGE", bounds: BOUNDS, centerX: 0.5, centerY: 0.5,
  orientation: defaultParams.orientation, fovRead: defaultParams.fovRead, fovPhase: defaultParams.fovPhase,
  sliceThickness: defaultParams.sliceThickness, sliceGap: defaultParams.sliceGap, sliceCount: defaultParams.sliceCount,
});

function renderViewport(plane: AnatomicalPlane, onCaps: (c: ImagingRuntimeCapabilities | null) => void) {
  function Harness() {
    const { position, publishPosition } = useVolumePosition();
    return createElement(MedicalViewport, {
      label: plane, plane, params: defaultParams, planning: { centerX: 0.5, centerY: 0.5 },
      onPlanningChange: () => undefined, onParamChange: () => undefined,
      volumePosition: position, onVolumePositionChange: publishPosition, session,
      planningBounds: BOUNDS, onVolumeGeometryChange: () => undefined, onOrientationChange: () => undefined,
      onImagingCapabilitiesChange: onCaps,
    });
  }
  return render(createElement(Harness));
}

beforeEach(() => {
  window.history.pushState({}, "", "/?engine=niivue&planning=world");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((t: string) =>
    t === "webgl2" ? ({} as unknown as RenderingContext) : null
  );
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.pushState({}, "", "/"); });

describe("MedicalViewport capability surfacing", () => {
  it("axial emits a capability with a sampler once the volume is ready", async () => {
    const onCaps = vi.fn();
    renderViewport("axial", onCaps);
    await waitFor(() => {
      const last = onCaps.mock.calls.at(-1)?.[0];
      expect(last?.volumeSampler).toBeTruthy();
    });
  });

  it("coronal never emits a capability", async () => {
    const onCaps = vi.fn();
    renderViewport("coronal", onCaps);
    await new Promise((r) => setTimeout(r, 30));
    for (const call of onCaps.mock.calls) expect(call[0]).toBeNull();
  });

  it("sagittal never emits a capability", async () => {
    const onCaps = vi.fn();
    renderViewport("sagittal", onCaps);
    await new Promise((r) => setTimeout(r, 30));
    for (const call of onCaps.mock.calls) expect(call[0]).toBeNull();
  });

  it("emits null on unmount", async () => {
    const onCaps = vi.fn();
    const { unmount } = renderViewport("axial", onCaps);
    await waitFor(() => expect(onCaps.mock.calls.at(-1)?.[0]?.volumeSampler).toBeTruthy());
    unmount();
    expect(onCaps.mock.calls.at(-1)?.[0]).toBeNull();
  });
});
