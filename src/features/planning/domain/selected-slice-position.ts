import type { VolumePosition } from "@/features/imaging/domain/volume-position";
import type { Prescription } from "@/features/planning/domain/prescription";
import { sliceOffsetsMm } from "@/features/planning/domain/prescription-math";
import { add, scale } from "@/features/planning/domain/vector";

/**
 * World position of a single stack slice's centre.
 *
 * The selected slice sits at the prescription centre translated along the plane
 * normal by that slice's signed offset. Slice positions come solely from
 * sliceOffsetsMm (the planning-owned source of truth); this helper only reads
 * the one the caller selected. Returns null when the index does not name a
 * slice, so a reference line is never drawn for a slice that is not there.
 */
export function selectedSliceCenter(
  prescription: Prescription,
  index: number
): VolumePosition | null {
  const offsets = sliceOffsetsMm(prescription);
  if (!Number.isInteger(index) || index < 0 || index >= offsets.length) return null;
  return add(prescription.center, scale(prescription.orientation.normal, offsets[index]));
}
