import type { ScanParams } from "@/features/planning/domain/planning.types";
import type { GuidanceItem, GuidanceResult } from "@/features/guidance/domain/guidance.types";

export function evaluatePlanningGuidance(params: ScanParams, coverage: number, selectedProtocol?: string): GuidanceResult {
  const items: GuidanceItem[] = [];

  // Coverage
  if (coverage >= 150 && coverage <= 180) {
    items.push({ label: "Coverage", status: "good", text: "Appropriate" });
  } else if (coverage < 130) {
    items.push({ label: "Coverage", status: "warn", text: "May be insufficient" });
  } else if (coverage > 200) {
    items.push({ label: "Coverage", status: "warn", text: "May be excessive" });
  } else {
    items.push({ label: "Coverage", status: "good", text: "Acceptable" });
  }

  // Slice Thickness
  if (params.sliceThickness >= 3 && params.sliceThickness <= 5) {
    items.push({ label: "Slice thickness", status: "good", text: "Appropriate" });
  } else if (params.sliceThickness >= 6 && params.sliceThickness <= 7) {
    items.push({ label: "Slice thickness", status: "warn", text: "Consider reducing" });
  } else if (params.sliceThickness > 7) {
    items.push({ label: "Slice thickness", status: "warn", text: "May be too large" });
  } else {
    items.push({ label: "Slice thickness", status: "good", text: "Acceptable" });
  }

  // Protocol match
  const protocolMap: Record<string, string[]> = {
    stroke: ["DWI", "T2 FLAIR", "T2 AXIAL"],
    tumor: ["T1 MPRAGE", "T2 FLAIR"],
    ms: ["T2 FLAIR", "T2 AXIAL", "T1 MPRAGE"],
  };
  const proto = selectedProtocol ?? "";
  const matchedAny = Object.values(protocolMap).some((seqs) =>
    seqs.some((s) => s.toLowerCase() === proto.toLowerCase())
  );
  if (matchedAny) {
    items.push({ label: "Protocol", status: "good", text: "Appropriate" });
  } else {
    items.push({ label: "Protocol", status: "warn", text: "Review selection" });
  }

  // Angulation
  if (Math.abs(params.angulation) <= 10) {
    items.push({ label: "Angulation", status: "good", text: "Good alignment" });
  } else {
    items.push({ label: "Angulation", status: "warn", text: "Review alignment" });
  }

  const allGood = items.every((i) => i.status === "good");
  return { items, allGood };
}
