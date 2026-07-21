import type { ImagingEngine, ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import { createLegacyJpgEngine } from "@/features/imaging/adapters/legacy-jpg/legacy-jpg-engine";
import { createNiivueEngine } from "@/features/imaging/adapters/niivue/niivue-engine";
import { hasWebGL2 } from "@/features/imaging/adapters/niivue/webgl-support";

/**
 * Engine selection boundary.
 *
 * Any kind that cannot be constructed falls back to the legacy JPG engine, so
 * requesting an unavailable engine degrades to a working viewport rather than
 * failing. A volume engine is only selected when the environment can actually
 * render it.
 */
export function createImagingEngine(kind: ImagingEngineKind): ImagingEngine {
  switch (kind) {
    case "jpg":
      return createLegacyJpgEngine();
    case "niivue":
      return hasWebGL2() ? createNiivueEngine() : createLegacyJpgEngine();
    default:
      return createLegacyJpgEngine();
  }
}
