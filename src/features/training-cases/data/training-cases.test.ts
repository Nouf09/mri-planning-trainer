import { describe, it, expect } from "vitest";
import { DEFAULT_CASE_ID, cases } from "@/features/training-cases/data/training-cases";

describe("training case catalogue", () => {
  it("contains the beginner routine brain case", () => {
    const routine = cases.find((c) => c.title === "Adult Routine Brain MRI");
    expect(routine).toBeDefined();
    expect(routine?.id).toBe(DEFAULT_CASE_ID);
  });

  it("offers exactly one available case, the routine one", () => {
    const available = cases.filter((c) => c.availability === "available");
    expect(available).toHaveLength(1);
    expect(available[0].title).toBe("Adult Routine Brain MRI");
  });

  it("still contains all three pre-existing cases", () => {
    for (const id of ["stroke", "tumor", "ms"]) {
      expect(cases.some((c) => c.id === id)).toBe(true);
    }
  });

  it("keeps the pre-existing case information unchanged", () => {
    const stroke = cases.find((c) => c.id === "stroke");
    expect(stroke?.title).toBe("Acute Stroke Evaluation");
    expect(stroke?.patient).toBe("62-year-old male");
    expect(stroke?.suggestedSequences).toEqual(["DWI", "FLAIR", "T2 Axial"]);
  });

  it("marks every pre-existing case as coming later, in the data", () => {
    for (const id of ["stroke", "tumor", "ms"]) {
      expect(cases.find((c) => c.id === id)?.availability).toBe("coming-later");
    }
  });

  it("names a default case that exists and is available", () => {
    const fallback = cases.find((c) => c.id === DEFAULT_CASE_ID);
    expect(fallback).toBeDefined();
    expect(fallback?.availability).toBe("available");
  });

  it("states no sequences for the foundational case", () => {
    const routine = cases.find((c) => c.id === DEFAULT_CASE_ID);
    expect(routine?.suggestedSequences).toEqual([]);
  });

  it("carries a unique id per case", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
