import type { AnatomicalPlane, ViewportSize } from "@/features/imaging/domain/viewport.types";
import type {
  Point2Dmm,
  PrescriptionProjection,
} from "@/features/planning/domain/prescription-math";

/** Millimetre-to-pixel scale for a viewport's own axes. */
export interface ViewScale {
  pxPerMmU: number;
  pxPerMmV: number;
}

const planeColors: Record<AnatomicalPlane, { line: string; fov: string }> = {
  sagittal: { line: "rgba(200,170,50,0.7)", fov: "rgba(200,170,50,0.35)" },
  coronal: { line: "rgba(80,180,100,0.7)", fov: "rgba(80,180,100,0.35)" },
  axial: { line: "rgba(40,200,200,0.7)", fov: "rgba(40,200,200,0.35)" },
};

export interface PrescriptionOverlayRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportSize,
    plane: AnatomicalPlane,
    projection: PrescriptionProjection,
    scale: ViewScale
  ): void;
}

/**
 * Draws a prescription from its projected world geometry.
 *
 * Position comes entirely from the projection: the viewport centre is only the
 * origin of the millimetre basis, never an assumption about where the
 * prescription sits. Screen y grows downward while the view's v axis grows
 * upward, hence the inversion.
 */
export function createPrescriptionOverlayRenderer(): PrescriptionOverlayRenderer {
  return {
    render(ctx, viewport, plane, projection, scale) {
      const w = viewport.width;
      const h = viewport.height;
      ctx.clearRect(0, 0, w, h);

      if (!Number.isFinite(projection.widthMm) || !Number.isFinite(projection.heightMm)) return;
      if (projection.widthMm <= 0 || projection.heightMm <= 0) return;

      const toScreen = (point: Point2Dmm) => ({
        x: w / 2 + point.uMm * scale.pxPerMmU,
        y: h / 2 - point.vMm * scale.pxPerMmV,
      });

      const colors = planeColors[plane];
      const center = toScreen(projection.center);
      const widthPx = projection.widthMm * scale.pxPerMmU;
      const heightPx = projection.heightMm * scale.pxPerMmV;

      ctx.save();
      ctx.translate(center.x, center.y);
      // Screen y is inverted relative to the view's v axis, so an in-plane
      // rotation appears reversed on screen.
      ctx.rotate((-projection.rotationDeg * Math.PI) / 180);

      ctx.strokeStyle = colors.fov;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-widthPx / 2, -heightPx / 2, widthPx, heightPx);
      ctx.setLineDash([]);

      ctx.fillStyle = colors.line;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Slice boundaries are already positioned in world millimetres, so they
      // are drawn without the rectangle's local transform.
      if (projection.sliceLines.length > 0) {
        ctx.save();
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        for (const line of projection.sliceLines) {
          const start = toScreen(line.start);
          const end = toScreen(line.end);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    },
  };
}
