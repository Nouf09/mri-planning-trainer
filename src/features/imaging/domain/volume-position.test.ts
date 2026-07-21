import { describe, it, expect } from "vitest";
import {
  arePositionsEqual,
  POSITION_EPSILON_MM,
  type VolumePosition,
} from "@/features/imaging/domain/volume-position";

const at = (x: number, y: number, z: number): VolumePosition => ({ x, y, z });

describe("arePositionsEqual", () => {
  it("treats identical positions as equal", () => {
    expect(arePositionsEqual(at(10, -20, 30), at(10, -20, 30))).toBe(true);
  });

  it("treats differences within epsilon as equal", () => {
    const delta = POSITION_EPSILON_MM / 2;
    expect(arePositionsEqual(at(0, 0, 0), at(delta, -delta, delta))).toBe(true);
  });

  it("treats a difference exactly at epsilon as equal", () => {
    expect(arePositionsEqual(at(0, 0, 0), at(POSITION_EPSILON_MM, 0, 0))).toBe(true);
  });

  it("treats differences beyond epsilon as different", () => {
    const delta = POSITION_EPSILON_MM * 10;
    expect(arePositionsEqual(at(0, 0, 0), at(delta, 0, 0))).toBe(false);
  });

  it("detects a difference on any single axis", () => {
    const origin = at(0, 0, 0);
    expect(arePositionsEqual(origin, at(1, 0, 0))).toBe(false);
    expect(arePositionsEqual(origin, at(0, 1, 0))).toBe(false);
    expect(arePositionsEqual(origin, at(0, 0, 1))).toBe(false);
  });

  it("handles negative coordinates", () => {
    expect(arePositionsEqual(at(-90, -126, -72), at(-90, -126, -72))).toBe(true);
    expect(arePositionsEqual(at(-90, -126, -72), at(-90, -126, -71))).toBe(false);
  });

  it("is symmetric", () => {
    const a = at(1, 2, 3);
    const b = at(1, 2, 4);
    expect(arePositionsEqual(a, b)).toBe(arePositionsEqual(b, a));
  });

  it("accepts a custom epsilon", () => {
    expect(arePositionsEqual(at(0, 0, 0), at(0.5, 0, 0), 1)).toBe(true);
    expect(arePositionsEqual(at(0, 0, 0), at(0.5, 0, 0), 0.1)).toBe(false);
  });

  it("uses a sub-voxel default tolerance", () => {
    expect(POSITION_EPSILON_MM).toBe(1e-3);
  });
});
