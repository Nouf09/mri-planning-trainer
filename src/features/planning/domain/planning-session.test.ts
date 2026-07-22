import { describe, it, expect } from "vitest";
import { BRAIN_SYNTHETIC_WORLD } from "@/features/imaging/data/brain-synthetic-world";
import { boundsFromDescriptor } from "@/features/imaging/domain/volume-geometry";
import {
  activeSequence,
  toPlanningSession,
  type PlanningSessionInput,
} from "@/features/planning/domain/planning-session";
import { isOrthonormalOrientation } from "@/features/planning/domain/orientation";

function makeInput(overrides: Partial<PlanningSessionInput> = {}): PlanningSessionInput {
  return {
    patient: { id: "P1", name: "DOE, JOHN" },
    study: { id: "S1", description: "MRI Brain" },
    sequenceId: "sequence-1",
    protocolName: "T1 MPRAGE",
    bounds: boundsFromDescriptor(BRAIN_SYNTHETIC_WORLD),
    centerX: 0.5,
    centerY: 0.5,
    angulation: 0,
    fovRead: 230,
    fovPhase: 230,
    sliceThickness: 5,
    sliceGap: 1,
    sliceCount: 30,
    ...overrides,
  };
}

describe("toPlanningSession", () => {
  it("builds one active sequence", () => {
    const session = toPlanningSession(makeInput());
    expect(session.sequences).toHaveLength(1);
    expect(session.activeSequenceId).toBe("sequence-1");
    expect(activeSequence(session)?.id).toBe("sequence-1");
  });

  it("names the sequence after the selected protocol", () => {
    const session = toPlanningSession(makeInput({ protocolName: "T2 FLAIR" }));
    expect(activeSequence(session)?.protocolName).toBe("T2 FLAIR");
    expect(activeSequence(session)?.name).toBe("T2 FLAIR");
  });

  it("carries patient and study through unchanged", () => {
    const session = toPlanningSession(makeInput());
    expect(session.patient.name).toBe("DOE, JOHN");
    expect(session.study.description).toBe("MRI Brain");
  });

  it("mirrors the acquisition parameters into the prescription", () => {
    const prescription = activeSequence(toPlanningSession(makeInput()))!.prescription;
    expect(prescription.fovRead).toBe(230);
    expect(prescription.fovPhase).toBe(230);
    expect(prescription.sliceThickness).toBe(5);
    expect(prescription.sliceGap).toBe(1);
    expect(prescription.sliceCount).toBe(30);
  });

  it("places a centred prescription at the world centre", () => {
    const prescription = activeSequence(toPlanningSession(makeInput()))!.prescription;
    expect(prescription.center).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("maps the normalized centre into world millimetres", () => {
    const prescription = activeSequence(
      toPlanningSession(makeInput({ centerX: 0.75, centerY: 0.25 }))
    )!.prescription;
    // A quarter of a 300 mm field of view is 75 mm; screen-down is negative y.
    expect(prescription.center.x).toBeCloseTo(75, 9);
    expect(prescription.center.y).toBeCloseTo(75, 9);
  });

  it("scales with the supplied descriptor rather than a fixed constant", () => {
    const bounds = boundsFromDescriptor({ widthMm: 200, heightMm: 200, depthMm: 200, center: { x: 0, y: 0, z: 0 } });
    const prescription = activeSequence(
      toPlanningSession(makeInput({ bounds, centerX: 1, centerY: 0.5 }))
    )!.prescription;
    expect(prescription.center.x).toBeCloseTo(100, 9);
  });

  it("respects a descriptor whose centre is not the origin", () => {
    const bounds = boundsFromDescriptor({ widthMm: 300, heightMm: 300, depthMm: 300, center: { x: 10, y: 20, z: 30 } });
    const prescription = activeSequence(toPlanningSession(makeInput({ bounds })))!.prescription;
    expect(prescription.center).toEqual({ x: 10, y: 20, z: 30 });
  });

  it("bakes the angulation scalar into an orthonormal orientation", () => {
    const prescription = activeSequence(
      toPlanningSession(makeInput({ angulation: 25 }))
    )!.prescription;
    expect(isOrthonormalOrientation(prescription.orientation, 1e-9)).toBe(true);
  });

  it("is pure: equal inputs give deeply equal sessions", () => {
    expect(toPlanningSession(makeInput())).toEqual(toPlanningSession(makeInput()));
  });
});
