import mriSagittal from "@/assets/mri-sagittal.jpg";
import mriCoronal from "@/assets/mri-coronal.jpg";
import mriAxial from "@/assets/mri-axial.jpg";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";

const images: Record<AnatomicalPlane, string> = {
  sagittal: mriSagittal,
  coronal: mriCoronal,
  axial: mriAxial,
};

/**
 * JPG engine. Serves the original per-plane images and remains the
 * guaranteed-working fallback for environments where a volume engine is
 * unavailable.
 */
export function createLegacyJpgEngine(): ImagingEngine {
  return {
    kind: "jpg",
    getBackgroundSource: (plane: AnatomicalPlane) => images[plane],
    dispose: () => {
      // Nothing to release: the images are plain module imports.
    },
  };
}
