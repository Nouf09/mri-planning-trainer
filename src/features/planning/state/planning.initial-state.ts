import type { ScanParams } from "@/features/planning/domain/planning.types";

const defaultParams: ScanParams = {
  fovRead: 230,
  fovPhase: 230,
  sliceThickness: 5,
  sliceGap: 1,
  sliceCount: 30,
  angulation: 0,
  tr: 400,
  te: 5,
  flipAngle: 90,
};

export { defaultParams };
