import { describe, it, expect } from "vitest";
import {
  SLICE_AXIS_BY_PLANE,
  WHEEL_STEP_THRESHOLD_PX,
  normalizeWheelDeltaY,
  sliceStepsFromWheel,
  voxelDeltaForPlane,
} from "@/features/imaging/domain/slice-navigation";

describe("slice axis mapping", () => {
  it("steps each plane along its own axis", () => {
    expect(SLICE_AXIS_BY_PLANE.sagittal).toBe("x");
    expect(SLICE_AXIS_BY_PLANE.coronal).toBe("y");
    expect(SLICE_AXIS_BY_PLANE.axial).toBe("z");
  });
});

describe("voxelDeltaForPlane", () => {
  it("moves only the axis belonging to the plane", () => {
    expect(voxelDeltaForPlane("sagittal", 1)).toEqual([1, 0, 0]);
    expect(voxelDeltaForPlane("coronal", 1)).toEqual([0, 1, 0]);
    expect(voxelDeltaForPlane("axial", 1)).toEqual([0, 0, 1]);
  });

  it("carries the sign of the step", () => {
    expect(voxelDeltaForPlane("sagittal", -3)).toEqual([-3, 0, 0]);
    expect(voxelDeltaForPlane("coronal", -3)).toEqual([0, -3, 0]);
    expect(voxelDeltaForPlane("axial", -3)).toEqual([0, 0, -3]);
  });

  it("produces no movement for a zero step", () => {
    expect(voxelDeltaForPlane("axial", 0)).toEqual([0, 0, 0]);
  });
});

describe("normalizeWheelDeltaY", () => {
  it("passes pixel deltas through unchanged", () => {
    expect(normalizeWheelDeltaY(120, 0)).toBe(120);
  });

  it("scales line deltas into pixels", () => {
    expect(normalizeWheelDeltaY(3, 1)).toBe(48);
  });

  it("scales page deltas into pixels", () => {
    expect(normalizeWheelDeltaY(2, 2)).toBe(200);
  });

  it("preserves direction", () => {
    expect(normalizeWheelDeltaY(-3, 1)).toBe(-48);
  });
});

describe("sliceStepsFromWheel", () => {
  it("advances one slice per full threshold scrolled up", () => {
    const result = sliceStepsFromWheel(0, -WHEEL_STEP_THRESHOLD_PX);
    expect(result.steps).toBe(1);
    expect(result.carry).toBe(0);
  });

  it("retreats one slice per full threshold scrolled down", () => {
    const result = sliceStepsFromWheel(0, WHEEL_STEP_THRESHOLD_PX);
    expect(result.steps).toBe(-1);
    expect(result.carry).toBe(0);
  });

  it("produces no step below the threshold", () => {
    const result = sliceStepsFromWheel(0, 10);
    expect(result.steps).toBe(0);
    expect(result.carry).toBe(10);
  });

  it("accumulates small trackpad deltas into a single step", () => {
    let carry = 0;
    let steps = 0;
    for (let i = 0; i < 10; i++) {
      const result = sliceStepsFromWheel(carry, 10);
      carry = result.carry;
      steps += result.steps;
    }
    expect(steps).toBe(-1);
  });

  it("does not lose movement across events", () => {
    const first = sliceStepsFromWheel(0, 60);
    const second = sliceStepsFromWheel(first.carry, 60);
    expect(first.steps).toBe(0);
    expect(second.steps).toBe(-1);
    expect(second.carry).toBe(20);
  });

  it("emits multiple steps for a large delta", () => {
    const result = sliceStepsFromWheel(0, -WHEEL_STEP_THRESHOLD_PX * 3);
    expect(result.steps).toBe(3);
  });

  it("keeps the carry below the threshold", () => {
    const result = sliceStepsFromWheel(0, 250);
    expect(Math.abs(result.carry)).toBeLessThan(WHEEL_STEP_THRESHOLD_PX);
  });

  it("accepts a custom threshold", () => {
    expect(sliceStepsFromWheel(0, -20, 20).steps).toBe(1);
  });
});
