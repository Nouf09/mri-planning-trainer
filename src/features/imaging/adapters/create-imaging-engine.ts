import type { ImagingEngine, ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import { createLegacyJpgEngine } from "@/features/imaging/adapters/legacy-jpg/legacy-jpg-engine";

/**
 * Engine selection boundary.
 *
 * Any kind that cannot be constructed falls back to the legacy JPG engine, so
 * requesting an unavailable engine degrades to a working viewport rather than
 * failing.
 */
export function createImagingEngine(kind: ImagingEngineKind): ImagingEngine {
  switch (kind) {
    case "jpg":
      return createLegacyJpgEngine();
    default:
      return createLegacyJpgEngine();
  }
}
