import type { AnatomicalPlane, ViewportSize } from "@/features/imaging/domain/viewport.types";
import type { ProjectionResult } from "@/features/imaging/projection/projection-model";
import { rotateKnobPosition } from "@/features/imaging/projection/hit-test-projection";
import { quadCenter, quadEdgeMidpoint, topEdgeIndex, type ProjectedQuad } from "@/features/imaging/projection/quad";

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

function tracePath(ctx: CanvasRenderingContext2D, quad: ProjectedQuad): void {
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  ctx.lineTo(quad[1].x, quad[1].y);
  ctx.lineTo(quad[2].x, quad[2].y);
  ctx.lineTo(quad[3].x, quad[3].y);
  ctx.closePath();
}

/**
 * Paints an already-projected prescription.
 *
 * Every coordinate arrives in viewport pixels, so this performs no geometry:
 * it only issues drawing commands. Handle positions come from the same helpers
 * hit testing uses.
 */
export function createPrescriptionOverlayRenderer(): PrescriptionOverlayRenderer {
  return {
    render(ctx, viewport, plane, projection, options = {}) {
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      if (!projection.isVisible || projection.outline === null) return;

      const colors = planeColors[plane];
      const outline = projection.outline;

      if (projection.sliceOutlines.length > 0) {
        ctx.save();
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        for (const slice of projection.sliceOutlines) {
          tracePath(ctx, slice);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = colors.fov;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      tracePath(ctx, outline);
      ctx.stroke();
      ctx.setLineDash([]);

      const center = quadCenter(outline);
      ctx.fillStyle = colors.line;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
      ctx.fill();

      if (options.showHandles) {
        for (const corner of outline) {
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        const knob = rotateKnobPosition(outline);
        if (knob) {
          const anchor = quadEdgeMidpoint(outline, topEdgeIndex(outline));
          ctx.beginPath();
          ctx.moveTo(anchor.x, anchor.y);
          ctx.lineTo(knob.x, knob.y);
          ctx.strokeStyle = colors.line;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(knob.x, knob.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    },
  };
}
