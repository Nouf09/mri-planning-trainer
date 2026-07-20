import { useRef, useEffect, useState, useCallback } from "react";
import mriSagittal from "@/assets/mri-sagittal.jpg";
import mriCoronal from "@/assets/mri-coronal.jpg";
import mriAxial from "@/assets/mri-axial.jpg";
import type { ScanParams, PlanningState } from "@/pages/Index";

const images = {
  sagittal: mriSagittal,
  coronal: mriCoronal,
  axial: mriAxial,
};

const planeStyles = {
  sagittal: { label: "text-console-warn", line: "rgba(200,170,50,0.7)", fov: "rgba(200,170,50,0.35)", crossOther: ["rgba(80,180,100,0.4)", "rgba(40,200,200,0.4)"] },
  coronal: { label: "text-console-success", line: "rgba(80,180,100,0.7)", fov: "rgba(80,180,100,0.35)", crossOther: ["rgba(200,170,50,0.4)", "rgba(40,200,200,0.4)"] },
  axial: { label: "text-primary", line: "rgba(40,200,200,0.7)", fov: "rgba(40,200,200,0.35)", crossOther: ["rgba(200,170,50,0.4)", "rgba(80,180,100,0.4)"] },
};

interface ViewportProps {
  label: string;
  plane: "sagittal" | "coronal" | "axial";
  params: ScanParams;
  planning: PlanningState;
  onPlanningChange: (s: Partial<PlanningState>) => void;
  onParamChange: (key: keyof ScanParams, value: number) => void;
}

type DragMode = "move" | "resize" | "rotate" | null;

export function MedicalViewport({ label, plane, params, planning, onPlanningChange, onParamChange }: ViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0, fovR: 0, fovP: 0, ang: 0 });

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
    ctx.clearRect(0, 0, w, h);

    const cx = planning.centerX * w;
    const cy = planning.centerY * h;
    const maxFov = 500;
    const fovW = (params.fovRead / maxFov) * w * 0.8;
    const fovH = (params.fovPhase / maxFov) * h * 0.8;
    const angle = (params.angulation * Math.PI) / 180;
    const s = planeStyles[plane];

    // Full-viewport crosshair lines (linked cross-reference)
    s.crossOther.forEach((color, i) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      if (i === 0) {
        // horizontal
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();
      } else {
        // vertical
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Planning overlay (rotated)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // FOV rect
    ctx.strokeStyle = s.fov;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(-fovW / 2, -fovH / 2, fovW, fovH);
    ctx.setLineDash([]);

    // Slice lines
    const totalSliceSpan = params.sliceCount * (params.sliceThickness + params.sliceGap);
    const scale = fovH / maxFov;
    const totalPx = totalSliceSpan * scale * 2;
    const sliceStep = totalPx / Math.max(params.sliceCount, 1);
    const startY = -(totalPx / 2) + sliceStep / 2;

    ctx.strokeStyle = s.line;
    ctx.lineWidth = 1;
    for (let i = 0; i < params.sliceCount; i++) {
      const y = startY + i * sliceStep;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-fovW / 2, y);
      ctx.lineTo(fovW / 2, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Center dot
    ctx.fillStyle = s.line;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Corner handles
    const corners = [
      [-fovW / 2, -fovH / 2],
      [fovW / 2, -fovH / 2],
      [fovW / 2, fovH / 2],
      [-fovW / 2, fovH / 2],
    ];
    corners.forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Rotate handle
    ctx.beginPath();
    ctx.moveTo(0, -fovH / 2);
    ctx.lineTo(0, -fovH / 2 - 20);
    ctx.strokeStyle = s.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -fovH / 2 - 20, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [params, planning, plane]);

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
    const w = canvas.width;
    const h = canvas.height;
    const pos = getCanvasPos(e);
    const cx = planning.centerX * w;
    const cy = planning.centerY * h;
    const maxFov = 500;
    const fovW = (params.fovRead / maxFov) * w * 0.8;
    const fovH = (params.fovPhase / maxFov) * h * 0.8;
    const angle = (params.angulation * Math.PI) / 180;

    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    if (Math.hypot(lx, ly - (-fovH / 2 - 20)) < 12) return "rotate";

    const corners = [[-fovW / 2, -fovH / 2], [fovW / 2, -fovH / 2], [fovW / 2, fovH / 2], [-fovW / 2, fovH / 2]];
    for (const [hx, hy] of corners) {
      if (Math.hypot(lx - hx, ly - hy) < 12) return "resize";
    }

    if (Math.abs(lx) < fovW / 2 && Math.abs(ly) < fovH / 2) return "move";
    return null;
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
        <span className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${planeStyles[plane].label}`}>{label}</span>
        <div className="flex gap-2 text-[9px] font-mono text-muted-foreground">
          <span>W: 1400</span>
          <span>L: 700</span>
        </div>
      </div>

      <div className="flex-1 relative min-h-0" ref={containerRef}>
        <img src={images[plane]} alt={`${label} MRI view`} className="absolute inset-0 w-full h-full object-cover opacity-90" />
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
