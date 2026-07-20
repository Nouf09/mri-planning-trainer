import { useState, useCallback } from "react";
import { ProtocolSidebar } from "@/components/ProtocolSidebar";
import { MedicalViewport } from "@/components/MedicalViewport";
import { ParametersPanel } from "@/components/ParametersPanel";
import { ClinicalCasePanel } from "@/components/ClinicalCasePanel";
import { Activity } from "lucide-react";

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

const protocolPresets: Record<string, Partial<ScanParams>> = {
  "T1 MPRAGE": { tr: 400, te: 5, flipAngle: 90 },
  "T2 FLAIR": { tr: 9000, te: 90, flipAngle: 150 },
  "DWI": { tr: 3000, te: 80, flipAngle: 90 },
  "T2 AXIAL": { tr: 5000, te: 100, flipAngle: 90, sliceThickness: 5, sliceGap: 1, sliceCount: 30, fovRead: 230, fovPhase: 230 },
};

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
const Index = () => {
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

  return (
    <div className="h-screen flex flex-col bg-console-dark overflow-hidden">
      <header className="h-10 flex items-center justify-between px-4 border-b border-border bg-console-panel flex-shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-wider text-primary">MRI PLANNING TRAINER</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">BETA</span>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground leading-tight">Interactive training tool for MRI slice planning and parameter selection with clinical feedback.</span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
          <span>PATIENT: DOE, JOHN</span>
          <span>ID: 2024-MR-00847</span>
          <span>1.5T MRI System – Training Mode</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-console-success animate-pulse-glow" />
            <span className="text-console-success">ONLINE</span>
          </div>
        </div>
      </header>

      <ClinicalCasePanel />
      <div className="flex-1 flex min-h-0">
        <ProtocolSidebar selected={selectedProtocol} onSelect={selectProtocol} />
        <main className="flex-1 grid grid-cols-3 gap-1 p-1 min-h-0 bg-console-dark">
          {(["sagittal", "coronal", "axial"] as const).map((plane) => (
            <MedicalViewport
              key={plane}
              label={plane.charAt(0).toUpperCase() + plane.slice(1)}
              plane={plane}
              params={params}
              planning={planning}
              onPlanningChange={updatePlanning}
              onParamChange={updateParam}
            />
          ))}
        </main>
        <ParametersPanel
          params={params}
          onParamChange={updateParam}
          autoAdjustSliceCount={autoAdjustSliceCount}
          onToggleAutoAdjust={() => setAutoAdjustSliceCount((prev) => !prev)}
          selectedProtocol={selectedProtocol}
        />
      </div>

      <footer className="h-7 flex items-center justify-between px-4 border-t border-border bg-console-panel text-[9px] font-mono text-muted-foreground flex-shrink-0">
        <span>SEQUENCE: T1 MPRAGE • MATRIX: 256×256 • BANDWIDTH: 200 Hz/Px</span>
        <span>SAR: 42% • SCAN TIME: 05:24</span>
        <span className="italic opacity-60">Educational simulation only. Not for clinical use.</span>
      </footer>
    </div>
  );
};

export default Index;
