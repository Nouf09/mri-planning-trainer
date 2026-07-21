import { useState, useCallback } from "react";
import type { ScanParams, PlanningState } from "@/features/planning/domain/planning.types";
import { defaultParams } from "@/features/planning/state/planning.initial-state";
import { protocolPresets } from "@/features/protocols/data/protocol-presets";

export function usePlanningSession() {
  const [params, setParams] = useState<ScanParams>(defaultParams);
  const [planning, setPlanning] = useState<PlanningState>({ centerX: 0.5, centerY: 0.5 });
  const [autoAdjustSliceCount, setAutoAdjustSliceCount] = useState(true);

  const [selectedProtocol, setSelectedProtocol] = useState("T1 MPRAGE");

  const updateParam = useCallback((key: keyof ScanParams, value: number) => {
    if (key === "sliceCount") {
      // Manual slice count edit disables auto-adjust
      setAutoAdjustSliceCount(false);
      setParams((prev) => ({ ...prev, [key]: value }));
      return;
    }

    setParams((prev) => {
      const next = { ...prev, [key]: value };

      // Auto-adjust slice count when FOV or thickness/gap change
      if (autoAdjustSliceCount && (key === "fovPhase" || key === "sliceThickness" || key === "sliceGap")) {
        const targetCoverage = next.fovPhase * 0.7; // ~70% of FOV Phase as target brain coverage
        const newCount = Math.ceil((targetCoverage + next.sliceGap) / (next.sliceThickness + next.sliceGap));
        next.sliceCount = Math.max(1, Math.min(60, newCount));
      }

      return next;
    });
  }, [autoAdjustSliceCount]);

  const selectProtocol = useCallback((name: string) => {
    setSelectedProtocol(name);
    const preset = protocolPresets[name];
    if (preset) {
      setParams((prev) => ({ ...prev, ...preset }));
    }
  }, []);
  const updatePlanning = useCallback((s: Partial<PlanningState>) => {
    setPlanning((prev) => ({ ...prev, ...s }));
  }, []);

  const toggleAutoAdjustSliceCount = useCallback(() => {
    setAutoAdjustSliceCount((prev) => !prev);
  }, []);

  return {
    params,
    planning,
    autoAdjustSliceCount,
    selectedProtocol,
    updateParam,
    selectProtocol,
    updatePlanning,
    toggleAutoAdjustSliceCount,
  };
}
