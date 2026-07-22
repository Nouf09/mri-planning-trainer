import type { ScanParams } from "@/features/planning/domain/planning.types";
import { NEUTRAL_ORIENTATION_INPUT } from "@/features/planning/domain/prescription-orientation";

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
  orientation: NEUTRAL_ORIENTATION_INPUT,
};

export { defaultParams };
