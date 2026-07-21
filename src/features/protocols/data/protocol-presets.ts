import type { ScanParams } from "@/features/planning/domain/planning.types";

const protocolPresets: Record<string, Partial<ScanParams>> = {
  "T1 MPRAGE": { tr: 400, te: 5, flipAngle: 90 },
  "T2 FLAIR": { tr: 9000, te: 90, flipAngle: 150 },
  "DWI": { tr: 3000, te: 80, flipAngle: 90 },
  "T2 AXIAL": { tr: 5000, te: 100, flipAngle: 90, sliceThickness: 5, sliceGap: 1, sliceCount: 30, fovRead: 230, fovPhase: 230 },
};

export { protocolPresets };
