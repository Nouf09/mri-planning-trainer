import { useRef, useEffect, useState, useCallback } from "react";
import type { ScanParams, PlanningState } from "@/features/planning/domain/planning.types";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { PlanningGeometry } from "@/features/imaging/domain/overlay.types";
import { useImagingEngine } from "@/features/imaging/hooks/use-imaging-engine";
import { useVolumeEngine } from "@/features/imaging/hooks/use-volume-engine";
import { useVolumeSync } from "@/features/imaging/hooks/use-volume-sync";
import { DEFAULT_VOLUME_SOURCE } from "@/features/imaging/data/volume-source";
import type { VolumePosition } from "@/features/imaging/domain/volume-position";

const planeLabelStyles: Record<AnatomicalPlane, string> = {
  sagittal: "text-console-warn",
  coronal: "text-console-success",
  axial: "text-primary",
};

interface ViewportProps {
  label: string;
  plane: AnatomicalPlane;
  params: ScanParams;
  planning: PlanningState;
  onPlanningChange: (s: Partial<PlanningState>) => void;
  onParamChange: (key: keyof ScanParams, value: number) => void;
  volumePosition: VolumePosition | null;
  onVolumePositionChange: (position: VolumePosition) => void;
}

type DragMode = "move" | "resize" | "rotate" | null;

export function MedicalViewport({ label, plane, params, planning, onPlanningChange, onParamChange, volumePosition, onVolumePositionChange }: ViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0, fovR: 0, fovP: 0, ang: 0 });
  const { engine, overlay } = useImagingEngine();

  const geometry: PlanningGeometry = {
    centerX: planning.centerX,
    centerY: planning.centerY,
    fovRead: params.fovRead,
    fovPhase: params.fovPhase,
    angulation: params.angulation,
    sliceCount: params.sliceCount,
    sliceThickness: params.sliceThickness,
    sliceGap: params.sliceGap,
  };

  const backgroundSource = engine.getBackgroundSource(plane);
  const volume = useVolumeEngine(engine, plane, DEFAULT_VOLUME_SOURCE);
  useVolumeSync({
    engine,
    status: volume.status,
    position: volumePosition,
    onPositionChange: onVolumePositionChange,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    overlay.render(ctx, { width: w, height: h }, plane, {
      centerX: planning.centerX,
      centerY: planning.centerY,
      fovRead: params.fovRead,
      fovPhase: params.fovPhase,
      angulation: params.angulation,
      sliceCount: params.sliceCount,
      sliceThickness: params.sliceThickness,
      sliceGap: params.sliceGap,
    });
  }, [params, planning, plane, overlay]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hitTest = (e: React.MouseEvent): DragMode => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const pos = getCanvasPos(e);
    return overlay.hitTest(pos, { width: canvas.width, height: canvas.height }, plane, geometry);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const mode = hitTest(e);
    if (!mode) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    dragStart.current = { x: pos.x, y: pos.y, cx: planning.centerX, cy: planning.centerY, fovR: params.fovRead, fovP: params.fovPhase, ang: params.angulation };
    setDragMode(mode);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragMode) {
      const mode = hitTest(e);
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = mode === "move" ? "move" : mode === "resize" ? "nwse-resize" : mode === "rotate" ? "crosshair" : "default";
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const pos = getCanvasPos(e);
    const st = dragStart.current;

    if (dragMode === "move") {
      onPlanningChange({
        centerX: Math.max(0.1, Math.min(0.9, st.cx + (pos.x - st.x) / w)),
        centerY: Math.max(0.1, Math.min(0.9, st.cy + (pos.y - st.y) / h)),
      });
    } else if (dragMode === "resize") {
      onParamChange("fovRead", Math.round(Math.max(100, Math.min(500, st.fovR + ((pos.x - st.x) / w) * 1000)) / 5) * 5);
      onParamChange("fovPhase", Math.round(Math.max(100, Math.min(500, st.fovP + ((pos.y - st.y) / h) * 1000)) / 5) * 5);
    } else if (dragMode === "rotate") {
      const cx = planning.centerX * w;
      const cy = planning.centerY * h;
      const delta = ((Math.atan2(pos.y - cy, pos.x - cx) - Math.atan2(st.y - cy, st.x - cx)) * 180) / Math.PI;
      onParamChange("angulation", Math.round(Math.max(-45, Math.min(45, st.ang + delta))));
    }
  };

  const onMouseUp = () => setDragMode(null);

  return (
    <div className="viewport-border rounded-sm bg-console-dark relative overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <span className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${planeLabelStyles[plane]}`}>{label}</span>
        <div className="flex gap-2 text-[9px] font-mono text-muted-foreground">
          <span>W: 1400</span>
          <span>L: 700</span>
        </div>
      </div>

      <div className="flex-1 relative min-h-0" ref={containerRef}>
        {backgroundSource && <img src={backgroundSource} alt={`${label} MRI view`} className="absolute inset-0 w-full h-full object-cover opacity-90" />}
        {volume.isVolume && <canvas ref={volume.canvasRef} className="absolute inset-0 w-full h-full" />}
        {volume.status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[9px] font-mono text-muted-foreground">
            LOADING VOLUME
          </div>
        )}
        {volume.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[9px] font-mono text-console-warn">
            VOLUME UNAVAILABLE
          </div>
        )}
        <div className="scanline absolute inset-0 pointer-events-none" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
      </div>

      <div className="px-3 py-1 border-t border-border/50 flex justify-between text-[9px] font-mono text-muted-foreground">
        <span>256×256</span>
        <span>TR: 2000 TE: 80</span>
      </div>
    </div>
  );
}
