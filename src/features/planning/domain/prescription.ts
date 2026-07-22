import type { VolumePosition } from "@/features/imaging/domain/volume-position";
import type { PlaneOrientation } from "@/features/planning/domain/orientation";

/**
 * A slice group to be acquired, described entirely in world millimetres.
 *
 * This is the planning object: where the slices sit in the patient, how they
 * are oriented, and how much they cover.
 */
export interface Prescription {
  /** Centre of the slice group, in world millimetres. */
  center: VolumePosition;
  orientation: PlaneOrientation;
  fovRead: number;
  fovPhase: number;
  sliceThickness: number;
  sliceGap: number;
  sliceCount: number;
}
