import type { OverlayRenderer } from "@/features/imaging/domain/overlay-renderer";
import type { PlanningGeometry } from "@/features/imaging/domain/overlay.types";
import type {
  AnatomicalPlane,
  Point2D,
  PlanningHandle,
  ViewportSize,
} from "@/features/imaging/domain/viewport.types";

const planeColors: Record<AnatomicalPlane, { line: string; fov: string; crossOther: string[] }> = {
  sagittal: { line: "rgba(200,170,50,0.7)", fov: "rgba(200,170,50,0.35)", crossOther: ["rgba(80,180,100,0.4)", "rgba(40,200,200,0.4)"] },
  coronal: { line: "rgba(80,180,100,0.7)", fov: "rgba(80,180,100,0.35)", crossOther: ["rgba(200,170,50,0.4)", "rgba(40,200,200,0.4)"] },
  axial: { line: "rgba(40,200,200,0.7)", fov: "rgba(40,200,200,0.35)", crossOther: ["rgba(200,170,50,0.4)", "rgba(80,180,100,0.4)"] },
};

const MAX_FOV = 500;

/** Planning prescription overlay: cross-reference lines, FOV box, slice stack and drag handles. */
export function createPlanningOverlayRenderer(): OverlayRenderer {
  return {
    render(
      ctx: CanvasRenderingContext2D,
      viewport: ViewportSize,
      plane: AnatomicalPlane,
      geometry: PlanningGeometry
    ): void {
      const w = viewport.width;
      const h = viewport.height;
      ctx.clearRect(0, 0, w, h);

      const cx = geometry.centerX * w;
      const cy = geometry.centerY * h;
      const maxFov = MAX_FOV;
      const fovW = (geometry.fovRead / maxFov) * w * 0.8;
      const fovH = (geometry.fovPhase / maxFov) * h * 0.8;
      const angle = (geometry.angulation * Math.PI) / 180;
      const s = planeColors[plane];

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
      const totalSliceSpan = geometry.sliceCount * (geometry.sliceThickness + geometry.sliceGap);
      const scale = fovH / maxFov;
      const totalPx = totalSliceSpan * scale * 2;
      const sliceStep = totalPx / Math.max(geometry.sliceCount, 1);
      const startY = -(totalPx / 2) + sliceStep / 2;

      ctx.strokeStyle = s.line;
      ctx.lineWidth = 1;
      for (let i = 0; i < geometry.sliceCount; i++) {
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
    },

    hitTest(
      point: Point2D,
      viewport: ViewportSize,
      _plane: AnatomicalPlane,
      geometry: PlanningGeometry
    ): PlanningHandle {
      const w = viewport.width;
      const h = viewport.height;
      const cx = geometry.centerX * w;
      const cy = geometry.centerY * h;
      const maxFov = MAX_FOV;
      const fovW = (geometry.fovRead / maxFov) * w * 0.8;
      const fovH = (geometry.fovPhase / maxFov) * h * 0.8;
      const angle = (geometry.angulation * Math.PI) / 180;

      const dx = point.x - cx;
      const dy = point.y - cy;
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
    },
  };
}
