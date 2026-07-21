export type AnatomicalPlane = "sagittal" | "coronal" | "axial";

export interface ViewportSize {
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type PlanningHandle = "move" | "resize" | "rotate" | null;
