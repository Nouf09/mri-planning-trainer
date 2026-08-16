import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePlanningSession } from "@/features/planning/hooks/use-planning-session";
import { DEFAULT_CASE_ID, cases } from "@/features/training-cases/data/training-cases";
import { BRAIN_SYNTHETIC_WORLD } from "@/features/imaging/data/brain-synthetic-world";
import { boundsFromDescriptor } from "@/features/imaging/domain/volume-geometry";

const BOUNDS = boundsFromDescriptor(BRAIN_SYNTHETIC_WORLD);

describe("default selected case", () => {
  it("starts on the beginner routine case", () => {
    const { result } = renderHook(() => usePlanningSession(BOUNDS));
    expect(result.current.selectedCaseId).toBe(DEFAULT_CASE_ID);
  });

  it("starts on a case that exists and is available", () => {
    const { result } = renderHook(() => usePlanningSession(BOUNDS));
    const startingCase = cases.find((c) => c.id === result.current.selectedCaseId);
    expect(startingCase?.title).toBe("Adult Routine Brain MRI");
    expect(startingCase?.availability).toBe("available");
  });

  it("still lets the selection change through the existing contract", () => {
    const { result } = renderHook(() => usePlanningSession(BOUNDS));
    act(() => result.current.selectCase("stroke"));
    expect(result.current.selectedCaseId).toBe("stroke");
    act(() => result.current.selectCase(null));
    expect(result.current.selectedCaseId).toBeNull();
  });
});
