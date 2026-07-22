import type { AnatomicalPlane, ViewportSize } from "@/features/imaging/domain/viewport.types";
import type { ProjectionResult } from "@/features/imaging/projection/projection-model";
import { ROTATE_STALK_PX } from "@/features/imaging/projection/hit-test-projection";

const planeColors: Record<AnatomicalPlane, { line: string; fov: string }> = {
  sagittal: { line: "rgba(200,170,50,0.7)", fov: "rgba(200,170,50,0.35)" },
  coronal: { line: "rgba(80,180,100,0.7)", fov: "rgba(80,180,100,0.35)" },
  axial: { line: "rgba(40,200,200,0.7)", fov: "rgba(40,200,200,0.35)" },
};

export interface PrescriptionRenderOptions {
  /** Draws the grab handles, so editable regions are discoverable. */
  showHandles?: boolean;
}

export interface PrescriptionOverlayRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportSize,
    plane: AnatomicalPlane,
    projection: ProjectionResult,
    options?: PrescriptionRenderOptions
  ): void;
}

/**
 * Paints an already-projected prescription.
 *
 * Every coordinate arrives in viewport pixels, so this performs no geometry:
 * it only issues drawing commands.
 */
export function createPrescriptionOverlayRenderer(): PrescriptionOverlayRenderer {
  return {
    render(ctx, viewport, plane, projection, options = {}) {
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      if (!projection.isVisible) return;

      const shape = projection.rectangle ?? projection.slab;
      if (!shape) return;

      const colors = planeColors[plane];

      ctx.save();
      ctx.translate(shape.center.x, shape.center.y);
      ctx.rotate(shape.rotationRad);

      ctx.strokeStyle = colors.fov;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-shape.widthPx / 2, -shape.heightPx / 2, shape.widthPx, shape.heightPx);
      ctx.setLineDash([]);

      ctx.fillStyle = colors.line;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      if (options.showHandles) {
        const halfWidth = shape.widthPx / 2;
        const halfHeight = shape.heightPx / 2;

        for (const [x, y] of [
          [-halfWidth, -halfHeight],
          [halfWidth, -halfHeight],
          [halfWidth, halfHeight],
          [-halfWidth, halfHeight],
        ]) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.moveTo(0, -halfHeight);
        ctx.lineTo(0, -halfHeight - ROTATE_STALK_PX);
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -halfHeight - ROTATE_STALK_PX, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      if (projection.sliceLines.length === 0) return;

      ctx.save();
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      for (const line of projection.sliceLines) {
        ctx.beginPath();
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}
