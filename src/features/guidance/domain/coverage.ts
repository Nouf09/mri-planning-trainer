import type { ScanParams } from "@/features/planning/domain/planning.types";

export function calculateCoverage(params: ScanParams): number {
  return params.sliceCount * params.sliceThickness + (params.sliceCount - 1) * params.sliceGap;
}
