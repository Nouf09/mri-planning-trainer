import { useEffect, useRef } from "react";
import type { ObliqueStackState } from "@/features/imaging/reslice/runtime/oblique-stack.types";
import {
  clearObliquePreview,
  paintObliquePreview,
} from "@/features/imaging/components/oblique-preview-painter";
import {
  positionForOffset,
  type AnatomicalPosition,
} from "@/features/imaging/domain/anatomical-direction";

interface ObliqueStackViewportProps {
  state: ObliqueStackState;
  onSelectSlice: (index: number) => void;
}

/** Scanner-console style position readout: explicit sign, one decimal, 0.0 at centre. */
function formatOffsetMm(offsetMm: number): string {
  const text = offsetMm.toFixed(1);
  if (text === "0.0" || text === "-0.0") return "0.0 mm";
  return offsetMm > 0 ? `+${text} mm` : `${text} mm`;
}

/** The centre reads as a word; anywhere else reads as its axis letters. */
function positionLabel(position: AnatomicalPosition): string {
  return position.kind === "centre" ? "Centre" : position.code;
}

function positionTitle(position: AnatomicalPosition | null): string | undefined {
  if (!position) return undefined;
  return position.kind === "centre"
    ? "Selected slice is at the prescription centre"
    : `Selected slice is ${position.description} of the prescription centre`;
}

/**
 * A read-only fourth viewport that browses the planned acquisition stack.
 *
 * It owns no imaging logic: it paints the given slice and forwards navigation
 * (slider, wheel, arrow keys) as index changes only. It never touches the
 * prescription or planning state. Wheel handling is scoped to this panel.
 */
export function ObliqueStackViewport({ state, onSelectSlice }: ObliqueStackViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (state.status === "ready") paintObliquePreview(canvas, state.image);
    else clearObliquePreview(canvas);
  }, [state]);

  const ready = state.status === "ready";
  const selectedIndex = ready ? state.selectedIndex : 0;
  const sliceCount = ready ? state.sliceCount : 0;
  const offsetMm = ready ? state.offsetMm : 0;
  // The stack publishes the direction of increasing offset; the signed reading
  // for the selected slice is presentation, so no runtime state carries it.
  const position = ready ? positionForOffset(state.offsetDirection, offsetMm) : null;

  // Native, non-passive wheel listener so preventDefault stops page scroll, and
  // strictly scoped to this panel.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !ready) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Scroll down advances to the next slice; up goes back. Deterministic.
      onSelectSlice(selectedIndex + (event.deltaY > 0 ? 1 : -1));
    };
    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, [ready, selectedIndex, onSelectSlice]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!ready) return;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onSelectSlice(selectedIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onSelectSlice(selectedIndex - 1);
    }
  };

  if (state.status === "hidden") return null;

  const message =
    state.status === "waiting-for-volume"
      ? "Load a Niivue volume to generate the planned slice."
      : state.status === "unsupported" || state.status === "invalid" || state.status === "error"
        ? state.message
        : null;

  return (
    <div
      ref={panelRef}
      className="viewport-border rounded-sm bg-console-dark relative overflow-hidden flex flex-col focus:outline-none focus:ring-1 focus:ring-primary/50"
      tabIndex={ready ? 0 : -1}
      onKeyDown={onKeyDown}
      aria-label="Oblique stack preview"
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
          Oblique Preview
        </span>
        <span
          className="text-[9px] font-mono text-muted-foreground"
          title={positionTitle(position)}
        >
          {ready
            ? `Slice ${selectedIndex + 1} / ${sliceCount} · ${formatOffsetMm(offsetMm)}${
                position ? ` · ${positionLabel(position)}` : ""
              }`
            : "Planned centre slice"}
        </span>
      </div>

      <div className="flex-1 relative min-h-0 flex items-center justify-center p-2">
        {ready ? (
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

      {ready && (
        <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, sliceCount - 1)}
            value={selectedIndex}
            onChange={(e) => onSelectSlice(Number(e.target.value))}
            aria-label="Selected slice"
            className="flex-1 h-1 accent-primary"
          />
          <span className="text-[9px] font-mono text-muted-foreground italic whitespace-nowrap">
            ↔ / wheel
          </span>
        </div>
      )}

      <div className="px-3 py-1 border-t border-border/50 text-[9px] font-mono text-muted-foreground italic">
        Educational preview — not for diagnostic use.
      </div>
    </div>
  );
}
