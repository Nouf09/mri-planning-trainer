import { describe, it, expect } from "vitest";
import { AXIAL, SAGITTAL } from "@/features/planning/domain/orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import { sliceOffsetsMm } from "@/features/planning/domain/prescription-math";
import { selectedSliceCenter } from "@/features/planning/domain/selected-slice-position";

const base: Prescription = {
  center: { x: 5, y: -3, z: 10 },
  orientation: AXIAL,
  fovRead: 200,
  fovPhase: 200,
  sliceThickness: 4,
  sliceGap: 1,
  sliceCount: 5,
};
// spacing = 5, offsets = [-10, -5, 0, 5, 10]

describe("selectedSliceCenter", () => {
  it("puts the centre slice at the prescription centre", () => {
    expect(selectedSliceCenter(base, 2)).toEqual({ x: 5, y: -3, z: 10 });
  });

  it("translates along the plane normal by the slice offset", () => {
    // AXIAL normal is +z; only z shifts.
    expect(selectedSliceCenter(base, 0)).toEqual({ x: 5, y: -3, z: 0 }); // -10
    expect(selectedSliceCenter(base, 4)).toEqual({ x: 5, y: -3, z: 20 }); // +10
  });

  it("equals centre + normal * sliceOffsetsMm for every index", () => {
    const offsets = sliceOffsetsMm(base);
    const n = base.orientation.normal;
    offsets.forEach((offset, index) => {
      expect(selectedSliceCenter(base, index)).toEqual({
        x: base.center.x + n.x * offset,
        y: base.center.y + n.y * offset,
        z: base.center.z + n.z * offset,
      });
    });
  });

  it("uses the orientation's own normal", () => {
    // SAGITTAL normal is +x; the offset now moves x, not z.
    const sag: Prescription = { ...base, orientation: SAGITTAL };
    expect(selectedSliceCenter(sag, 0)).toEqual({ x: -5, y: -3, z: 10 });
    expect(selectedSliceCenter(sag, 4)).toEqual({ x: 15, y: -3, z: 10 });
  });

  it("returns the centre for a single-slice stack", () => {
    const single: Prescription = { ...base, sliceCount: 1 };
    expect(selectedSliceCenter(single, 0)).toEqual({ x: 5, y: -3, z: 10 });
  });

  it("returns null for an index that names no slice", () => {
    expect(selectedSliceCenter(base, -1)).toBeNull();
    expect(selectedSliceCenter(base, 5)).toBeNull();
    expect(selectedSliceCenter(base, 2.5)).toBeNull();
    expect(selectedSliceCenter(base, Number.NaN)).toBeNull();
  });

  it("returns null when there are no slices", () => {
    expect(selectedSliceCenter({ ...base, sliceCount: 0 }, 0)).toBeNull();
  });
});
