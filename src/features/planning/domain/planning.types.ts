import type { PrescriptionOrientationInput } from "@/features/planning/domain/prescription-orientation";

export interface ScanParams {
  fovRead: number;
  fovPhase: number;
  sliceThickness: number;
  sliceGap: number;
  sliceCount: number;
  angulation: number;
  tr: number;
  te: number;
  flipAngle: number;
  /** World-mode prescription orientation. Legacy planning uses `angulation`. */
  orientation: PrescriptionOrientationInput;
}

export interface PlanningState {
  centerX: number;
  centerY: number;
}
