import { isFiniteQuad, type ProjectedQuad } from "@/features/imaging/projection/quad";

/**
 * Colour of the selected-slice reference line.
 *
 * A single bright, plane-independent stroke so the currently selected slice
 * reads as "active" against the dimmer per-plane slab lines in every view.
 */
export const REFERENCE_LINE_COLOR = "rgba(255,255,255,0.95)";

export interface ReferenceLineRenderer {
  /**
   * Strokes one already-projected slice outline as the reference line.
   *
   * The outline is the selected slice's quad from the shared projection: a
   * rectangle in a face-on view, collapsed to a line edge-on. Passing null (no
   * slice selected, or the selected slice does not project) draws nothing.
   */
  render(ctx: CanvasRenderingContext2D, outline: ProjectedQuad | null | undefined): void;
}

/**
 * Paints an already-projected reference line.
 *
 * Every coordinate arrives in viewport pixels, so this performs no geometry: it
 * only issues drawing commands. It is informational and read-only — it never
 * participates in hit testing.
 */
export function createReferenceLineRenderer(): ReferenceLineRenderer {
  return {
    render(ctx, outline) {
      if (outline == null || !isFiniteQuad(outline)) return;

      ctx.save();
      ctx.strokeStyle = REFERENCE_LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(outline[0].x, outline[0].y);
      ctx.lineTo(outline[1].x, outline[1].y);
      ctx.lineTo(outline[2].x, outline[2].y);
      ctx.lineTo(outline[3].x, outline[3].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },
  };
}
