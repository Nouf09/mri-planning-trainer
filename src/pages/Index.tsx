import { ProtocolSidebar } from "@/components/ProtocolSidebar";
import { MedicalViewport } from "@/components/MedicalViewport";
import { ParametersPanel } from "@/components/ParametersPanel";
import { ClinicalCasePanel } from "@/components/ClinicalCasePanel";
import { Activity } from "lucide-react";
import { usePlanningSession } from "@/features/planning/hooks/use-planning-session";
import { useVolumePosition } from "@/features/imaging/hooks/use-volume-position";

const Index = () => {
  const {
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
  } = usePlanningSession();

  const { position: volumePosition, publishPosition } = useVolumePosition();

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

      <ClinicalCasePanel selectedCaseId={selectedCaseId} onSelectCase={selectCase} />
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
              volumePosition={volumePosition}
              onVolumePositionChange={publishPosition}
              session={session}
            />
          ))}
        </main>
        <ParametersPanel
          params={params}
          onParamChange={updateParam}
          autoAdjustSliceCount={autoAdjustSliceCount}
          onToggleAutoAdjust={toggleAutoAdjustSliceCount}
          selectedProtocol={selectedProtocol}
          selectedCaseId={selectedCaseId}
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
