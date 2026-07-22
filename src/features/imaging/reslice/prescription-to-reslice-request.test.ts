import { describe, it, expect } from "vitest";
import { AXIAL } from "@/features/planning/domain/orientation";
import { orientationFromAngles } from "@/features/planning/domain/prescription-orientation";
import type { Prescription } from "@/features/planning/domain/prescription";
import {
  DEFAULT_INTERPOLATION,
  DEFAULT_OUT_OF_BOUNDS,
  prescriptionToResliceRequest,
} from "@/features/imaging/reslice/prescription-to-reslice-request";
import { validateObliqueSliceRequest } from "@/features/imaging/reslice/oblique-slice-request";

function makePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    center: { x: 10, y: -20, z: 30 },
    orientation: AXIAL,
    fovRead: 230,
    fovPhase: 190,
    sliceThickness: 5,
    sliceGap: 1,
    sliceCount: 20,
    ...overrides,
  };
}

const OPTIONS = { volumeId: "vol-1", outputWidthPx: 256, outputHeightPx: 192 };

describe("prescription to reslice request", () => {
  it("preserves the prescription centre", () => {
    const request = prescriptionToResliceRequest(makePrescription(), OPTIONS);
    expect(request.centerWorldMm).toEqual({ x: 10, y: -20, z: 30 });
  });

  it("copies the orientation basis exactly", () => {
    const orientation = orientationFromAngles({ tiltReadDeg: 20, tiltPhaseDeg: -10, inPlaneDeg: 35 })!;
    const request = prescriptionToResliceRequest(makePrescription({ orientation }), OPTIONS);
    expect(request.readDirectionWorld).toEqual(orientation.readDirection);
    expect(request.phaseDirectionWorld).toEqual(orientation.phaseDirection);
    expect(request.normalDirectionWorld).toEqual(orientation.normal);
  });

  it("preserves the field of view", () => {
    const request = prescriptionToResliceRequest(makePrescription(), OPTIONS);
    expect(request.fovReadMm).toBe(230);
    expect(request.fovPhaseMm).toBe(190);
  });

  it("preserves the requested output size", () => {
    const request = prescriptionToResliceRequest(makePrescription(), OPTIONS);
    expect(request.outputWidthPx).toBe(256);
    expect(request.outputHeightPx).toBe(192);
  });

  it("carries the volume id", () => {
    expect(prescriptionToResliceRequest(makePrescription(), OPTIONS).volumeId).toBe("vol-1");
  });

  it("defaults to the centre slice", () => {
    expect(prescriptionToResliceRequest(makePrescription(), OPTIONS).sliceOffsetMm).toBe(0);
  });

  it("passes an explicit slice offset through", () => {
    const request = prescriptionToResliceRequest(makePrescription(), { ...OPTIONS, sliceOffsetMm: -12.5 });
    expect(request.sliceOffsetMm).toBe(-12.5);
  });

  it("uses the documented defaults", () => {
    const request = prescriptionToResliceRequest(makePrescription(), OPTIONS);
    expect(request.interpolation).toBe(DEFAULT_INTERPOLATION);
    expect(request.outOfBounds).toBe(DEFAULT_OUT_OF_BOUNDS);
    expect(DEFAULT_INTERPOLATION).toBe("trilinear");
    expect(DEFAULT_OUT_OF_BOUNDS).toBe("transparent");
  });

  it("honours explicit modes", () => {
    const request = prescriptionToResliceRequest(makePrescription(), {
      ...OPTIONS,
      interpolation: "nearest",
      outOfBounds: "clamp",
    });
    expect(request.interpolation).toBe("nearest");
    expect(request.outOfBounds).toBe("clamp");
  });

  it("produces a request that validates", () => {
    const orientation = orientationFromAngles({ tiltReadDeg: 30, tiltPhaseDeg: 15, inPlaneDeg: -20 })!;
    const request = prescriptionToResliceRequest(makePrescription({ orientation }), OPTIONS);
    expect(validateObliqueSliceRequest(request)).toEqual({ status: "valid" });
  });

  it("does not mutate or alias the prescription", () => {
    const prescription = makePrescription();
    const snapshot = JSON.parse(JSON.stringify(prescription));
    const request = prescriptionToResliceRequest(prescription, OPTIONS);
    expect(prescription).toEqual(snapshot);
    expect(request.centerWorldMm).not.toBe(prescription.center);
    expect(request.readDirectionWorld).not.toBe(prescription.orientation.readDirection);
  });

  it("ignores slice thickness and count, which are not part of a single plane", () => {
    const request = prescriptionToResliceRequest(
      makePrescription({ sliceThickness: 99, sliceCount: 1 }),
      OPTIONS
    );
    expect(request).not.toHaveProperty("sliceThickness");
    expect(request).not.toHaveProperty("sliceCount");
  });
});
