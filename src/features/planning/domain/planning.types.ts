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
}

export interface PlanningState {
  centerX: number;
  centerY: number;
}
