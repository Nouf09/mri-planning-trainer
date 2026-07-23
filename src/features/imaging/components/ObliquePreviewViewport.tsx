import { useEffect, useRef } from "react";
import type { ObliquePreviewState } from "@/features/imaging/reslice/runtime/oblique-preview.types";
import {
  clearObliquePreview,
  paintObliquePreview,
} from "@/features/imaging/components/oblique-preview-painter";

interface ObliquePreviewViewportProps {
  state: ObliquePreviewState;
}

/**
 * A read-only fourth viewport showing the planned centre slice sampled from the
 * loaded volume. It owns no imaging logic: it renders whatever state it is given
 * and paints ready pixels. No interaction handlers are registered.
 */
export function ObliquePreviewViewport({ state }: ObliquePreviewViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (state.status === "ready") {
      paintObliquePreview(canvas, state.image);
    } else {
      // Never leave a previous slice visible behind a message.
      clearObliquePreview(canvas);
    }
  }, [state]);

  if (state.status === "hidden") return null;

  const message =
    state.status === "waiting-for-volume"
      ? "Load a Niivue volume to generate the planned slice."
      : state.status === "unsupported" || state.status === "invalid" || state.status === "error"
        ? state.message
        : null;

  return (
    <div className="viewport-border rounded-sm bg-console-dark relative overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
          Oblique Preview
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">Planned centre slice</span>
      </div>

      <div className="flex-1 relative min-h-0 flex items-center justify-center p-2">
        {state.status === "ready" ? (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full"
            style={{ imageRendering: "pixelated", aspectRatio: `${state.image.width} / ${state.image.height}` }}
          />
        ) : (
          <p className="text-[10px] font-mono text-muted-foreground text-center px-4 leading-relaxed">
            {message}
          </p>
        )}
      </div>

      <div className="px-3 py-1 border-t border-border/50 text-[9px] font-mono text-muted-foreground italic">
        Educational preview — not for diagnostic use.
      </div>
    </div>
  );
}
