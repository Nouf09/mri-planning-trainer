import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { VolumeSource } from "@/features/imaging/domain/volume.types";
import type { VolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";
import {
  arePositionsEqual,
  type VolumePosition,
} from "@/features/imaging/domain/volume-position";
import { voxelDeltaForPlane } from "@/features/imaging/domain/slice-navigation";
import type { VolumeGeometry } from "@/features/imaging/domain/volume-geometry";
import { readVolumeGeometry } from "@/features/imaging/adapters/niivue/read-volume-geometry";
import {
  buildVolumeSamplerCapability,
  type NiivueVolumeImageLike,
  type VolumeSamplerCapability,
  type VolumeSamplerProvider,
} from "@/features/imaging/adapters/niivue/volume-sampler-capability";

/**
 * Minimal surface this adapter uses. Declared locally so Niivue types never
 * cross the imaging feature boundary.
 */
interface NiivueLike {
  attachToCanvas(canvas: HTMLCanvasElement): Promise<unknown>;
  loadVolumes(volumes: { url: string }[]): Promise<unknown>;
  setSliceType(sliceType: number): void;
  cleanup(): void;
  drawScene(): void;
  moveCrosshairInVox(x: number, y: number, z: number): void;
  mm2frac(mm: [number, number, number]): ArrayLike<number>;
  frac2mm(frac: [number, number, number]): ArrayLike<number>;
  scene: { crosshairPos: ArrayLike<number> };
  onLocationChange: (location: unknown) => void;
  volumes?: NiivueVolumeImageLike[];
}

/** The subset of Niivue's location payload this adapter consumes. */
interface NiivueLocationLike {
  mm?: ArrayLike<number>;
}

const VOLUME_CENTER_FRAC: [number, number, number] = [0.5, 0.5, 0.5];

function toPosition(mm: ArrayLike<number>): VolumePosition {
  return { x: mm[0], y: mm[1], z: mm[2] };
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
export function createNiivueEngine(): VolumeImagingEngine & VolumeSamplerProvider {
  let instance: NiivueLike | null = null;
  let attachedCanvas: HTMLCanvasElement | null = null;
  let generation = 0;
  // Stable identity of the loaded source, for stale-result invalidation.
  let loadedVolumeId: string | null = null;

  // Echo guards. `applying` blocks synchronous re-entry while a position is
  // being written; `lastKnown` additionally rejects asynchronous echoes, which
  // the flag alone cannot catch. Together they enforce the invariant that only
  // user-driven interaction ever reaches the listener.
  let applying = false;
  let lastKnown: VolumePosition | null = null;
  let positionListener: ((position: VolumePosition) => void) | null = null;

  const handleLocationChange = (location: unknown): void => {
    if (applying) return;
    const mm = (location as NiivueLocationLike | null)?.mm;
    if (!mm || mm.length < 3) return;

    const next = toPosition(mm);
    if (lastKnown && arePositionsEqual(lastKnown, next)) return;

    lastKnown = next;
    positionListener?.(next);
  };

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
      created.onLocationChange = handleLocationChange;

      instance = created;
      attachedCanvas = canvas;
    },

    async loadVolume(source: VolumeSource): Promise<void> {
      if (!instance) return;
      const loadGeneration = generation;
      await instance.loadVolumes([{ url: source.url }]);
      // Swallow results that arrive after teardown.
      if (loadGeneration !== generation) return;
      loadedVolumeId = source.url;
    },

    setPosition(position: VolumePosition): void {
      if (!instance) return;
      // Nothing to do, and re-writing would risk an echo.
      if (lastKnown && arePositionsEqual(lastKnown, position)) return;

      applying = true;
      try {
        const frac = instance.mm2frac([position.x, position.y, position.z]);
        instance.scene.crosshairPos = frac;
        instance.drawScene();
        lastKnown = { ...position };
      } finally {
        applying = false;
      }
    },

    setPositionListener(listener: ((position: VolumePosition) => void) | null): void {
      positionListener = listener;
    },

    getPosition(): VolumePosition | null {
      if (!instance) return null;
      const frac = instance.scene.crosshairPos;
      if (!frac || frac.length < 3) return null;
      return toPosition(instance.frac2mm([frac[0], frac[1], frac[2]]));
    },

    getCenterPosition(): VolumePosition | null {
      if (!instance) return null;
      return toPosition(instance.frac2mm(VOLUME_CENTER_FRAC));
    },

    stepSlice(plane: AnatomicalPlane, steps: number): void {
      if (!instance || steps === 0) return;
      const [x, y, z] = voxelDeltaForPlane(plane, steps);
      // Niivue clamps to the volume bounds and reports the move through
      // onLocationChange, so this travels the same path as any other
      // user-driven interaction.
      instance.moveCrosshairInVox(x, y, z);
    },

    getVolumeGeometry(): VolumeGeometry | null {
      if (!instance) return null;
      return readVolumeGeometry(instance.volumes?.[0]);
    },

    getVolumeSamplerCapability(): VolumeSamplerCapability | null {
      const image = instance?.volumes?.[0];
      if (!image || !loadedVolumeId) return null;
      return buildVolumeSamplerCapability(loadedVolumeId, image);
    },

    navigateToScreenPoint(clientX: number, clientY: number): void {
      if (!instance || !attachedCanvas) return;

      // Replay the click on the engine's own canvas rather than converting the
      // coordinate here. Niivue then applies its own device pixel ratio, canvas
      // bounds and tile selection, and reports the move through
      // onLocationChange like any other click.
      //
      // The pair matters: a lone mousedown would leave the engine believing a
      // button is still held.
      const shared = { clientX, clientY, bubbles: false, cancelable: true, button: 0 };
      attachedCanvas.dispatchEvent(new MouseEvent("mousedown", { ...shared, buttons: 1 }));
      attachedCanvas.dispatchEvent(new MouseEvent("mouseup", { ...shared, buttons: 0 }));
    },

    dispose(): void {
      generation++;
      const canvas = attachedCanvas;
      if (instance) {
        try {
          instance.onLocationChange = () => undefined;
          instance.cleanup();
        } catch {
          // Teardown must not throw during unmount.
        }
      }
      instance = null;
      attachedCanvas = null;
      positionListener = null;
      lastKnown = null;
      applying = false;
      loadedVolumeId = null;
      releaseContext(canvas);
    },
  };
}
