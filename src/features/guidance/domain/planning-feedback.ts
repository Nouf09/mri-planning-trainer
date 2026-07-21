import type { ScanParams } from "@/features/planning/domain/planning.types";
import type { FeedbackItem } from "@/features/guidance/domain/guidance.types";

export function evaluatePlanningFeedback(params: ScanParams, coverage: number): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  // Coverage
  if (coverage < 140) items.push({ msg: "Coverage may be insufficient for full brain.", status: "warn" });
  else if (coverage <= 180) items.push({ msg: "Coverage appropriate for brain.", status: "success" });

  // Slice Thickness
  if (params.sliceThickness > 6) items.push({ msg: "Slice thickness may be too large for brain MRI.", status: "warn" });
  else if (params.sliceThickness >= 3 && params.sliceThickness <= 5) items.push({ msg: "Good slice thickness for brain imaging.", status: "success" });

  // Slice Gap
  if (params.sliceGap > 2) items.push({ msg: "Slice gap may reduce anatomical continuity.", status: "warn" });
  else if (params.sliceGap >= 0 && params.sliceGap <= 1) items.push({ msg: "Optimal slice gap.", status: "success" });

  // Angulation
  if (Math.abs(params.angulation) > 25) items.push({ msg: "High angulation may distort brain symmetry.", status: "warn" });

  // FOV
  if (params.fovRead < 180) items.push({ msg: "FOV may be too small.", status: "warn" });

  return items;
}
