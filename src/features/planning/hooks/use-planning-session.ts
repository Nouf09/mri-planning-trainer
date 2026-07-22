import { useState, useCallback, useMemo } from "react";
import { BRAIN_SYNTHETIC_WORLD } from "@/features/imaging/data/brain-synthetic-world";
import { toPlanningSession } from "@/features/planning/domain/planning-session";
import {
  DEFAULT_SEQUENCE_ID,
  EDUCATIONAL_PATIENT,
  EDUCATIONAL_STUDY,
} from "@/features/planning/data/educational-session";
import type { ScanParams, PlanningState } from "@/features/planning/domain/planning.types";
import { defaultParams } from "@/features/planning/state/planning.initial-state";
import { protocolPresets } from "@/features/protocols/data/protocol-presets";

export function usePlanningSession() {
  const [params, setParams] = useState<ScanParams>(defaultParams);
  const [planning, setPlanning] = useState<PlanningState>({ centerX: 0.5, centerY: 0.5 });
  const [autoAdjustSliceCount, setAutoAdjustSliceCount] = useState(true);

  const [selectedProtocol, setSelectedProtocol] = useState("T1 MPRAGE");

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

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

  const selectCase = useCallback((caseId: string | null) => {
    setSelectedCaseId(caseId);
  }, []);

  // Derived, not owned: params and planning stay authoritative during the
  // migration, so the session cannot drift from them.
  const session = useMemo(
    () =>
      toPlanningSession({
        patient: EDUCATIONAL_PATIENT,
        study: EDUCATIONAL_STUDY,
        sequenceId: DEFAULT_SEQUENCE_ID,
        protocolName: selectedProtocol,
        world: BRAIN_SYNTHETIC_WORLD,
        centerX: planning.centerX,
        centerY: planning.centerY,
        angulation: params.angulation,
        fovRead: params.fovRead,
        fovPhase: params.fovPhase,
        sliceThickness: params.sliceThickness,
        sliceGap: params.sliceGap,
        sliceCount: params.sliceCount,
      }),
    [planning, params, selectedProtocol]
  );

  return {
    params,
    planning,
    session,
    autoAdjustSliceCount,
    selectedProtocol,
    selectedCaseId,
    updateParam,
    selectProtocol,
    updatePlanning,
    toggleAutoAdjustSliceCount,
    selectCase,
  };
}
