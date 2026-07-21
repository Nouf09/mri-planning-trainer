import type { VolumeSource } from "@/features/imaging/domain/volume.types";

/**
 * The single educational volume used by the trainer.
 *
 * MNI152 template (derived from ICBM 152 Nonlinear 2009), served from public/.
 * An anatomical average rather than an individual scan, so it contains no
 * patient-identifiable data.
 */
export const DEFAULT_VOLUME_SOURCE: VolumeSource = {
  url: `${import.meta.env.BASE_URL}volumes/mni152.nii.gz`,
  name: "MNI152",
};
