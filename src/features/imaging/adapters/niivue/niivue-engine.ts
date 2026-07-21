import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { VolumeSource } from "@/features/imaging/domain/volume.types";
import type { VolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";

/**
 * Minimal surface this adapter uses. Declared locally so Niivue types never
 * cross the imaging feature boundary.
 */
interface NiivueLike {
  attachToCanvas(canvas: HTMLCanvasElement): Promise<unknown>;
  loadVolumes(volumes: { url: string }[]): Promise<unknown>;
  setSliceType(sliceType: number): void;
  cleanup(): void;
}

/**
 * Niivue-backed volume engine.
 *
 * The library is imported lazily so it stays out of the main bundle while the
 * default engine is the legacy JPG engine.
 *
 * Teardown correctness matters here: WebGL contexts are a limited browser
 * resource, so every attach is paired with a cleanup. A generation counter
 * invalidates in-flight async work instead of a permanent disposed flag, so a
 * dispose/mount cycle (React Strict Mode) re-attaches correctly.
 */
export function createNiivueEngine(): VolumeImagingEngine {
  let instance: NiivueLike | null = null;
  let attachedCanvas: HTMLCanvasElement | null = null;
  let generation = 0;

  const releaseContext = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    try {
      const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // Losing the context is a best-effort optimisation, not a requirement.
    }
  };

  return {
    kind: "niivue",

    // The volume is painted into the engine's own canvas, so there is no
    // background image for the viewport to render.
    getBackgroundSource: () => null,

    async mount(canvas: HTMLCanvasElement, plane: AnatomicalPlane): Promise<void> {
      // Already attached to this canvas: nothing to do.
      if (instance && attachedCanvas === canvas) return;
      // Attached elsewhere: release before re-attaching.
      if (instance) this.dispose();

      const mountGeneration = ++generation;
      const { Niivue, SLICE_TYPE } = await import("@niivue/niivue");
      if (mountGeneration !== generation) return;

      const created = new Niivue() as unknown as NiivueLike;
      await created.attachToCanvas(canvas);

      // Disposed or re-mounted while attaching: discard this instance.
      if (mountGeneration !== generation) {
        created.cleanup();
        return;
      }

      const sliceTypeByPlane: Record<AnatomicalPlane, number> = {
        axial: SLICE_TYPE.AXIAL,
        coronal: SLICE_TYPE.CORONAL,
        sagittal: SLICE_TYPE.SAGITTAL,
      };
      created.setSliceType(sliceTypeByPlane[plane]);

      instance = created;
      attachedCanvas = canvas;
    },

    async loadVolume(source: VolumeSource): Promise<void> {
      if (!instance) return;
      const loadGeneration = generation;
      await instance.loadVolumes([{ url: source.url }]);
      // Swallow results that arrive after teardown.
      if (loadGeneration !== generation) return;
    },

    dispose(): void {
      generation++;
      const canvas = attachedCanvas;
      if (instance) {
        try {
          instance.cleanup();
        } catch {
          // Teardown must not throw during unmount.
        }
      }
      instance = null;
      attachedCanvas = null;
      releaseContext(canvas);
    },
  };
}
