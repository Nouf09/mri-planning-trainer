import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";

import type { ScanParams } from "@/features/planning/domain/planning.types";
import { calculateCoverage } from "@/features/guidance/domain/coverage";
import { evaluatePlanningFeedback } from "@/features/guidance/domain/planning-feedback";
import { evaluatePlanningGuidance } from "@/features/guidance/domain/planning-guidance";

interface ParamConfig {
  key: keyof ScanParams;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const paramConfigs: ParamConfig[] = [
  { key: "fovRead", label: "FOV Read", unit: "mm", min: 100, max: 500, step: 5 },
  { key: "fovPhase", label: "FOV Phase", unit: "mm", min: 100, max: 500, step: 5 },
  { key: "sliceThickness", label: "Slice Thickness", unit: "mm", min: 0.5, max: 10, step: 0.5 },
  { key: "sliceGap", label: "Slice Gap", unit: "mm", min: 0, max: 5, step: 0.1 },
  { key: "sliceCount", label: "Slice Count", unit: "", min: 1, max: 60, step: 1 },
  { key: "angulation", label: "Angulation (Yaw)", unit: "°", min: -45, max: 45, step: 1 },
];

interface ParametersPanelProps {
  params: ScanParams;
  onParamChange: (key: keyof ScanParams, value: number) => void;
  autoAdjustSliceCount?: boolean;
  onToggleAutoAdjust?: () => void;
  selectedProtocol?: string;
}

export function ParametersPanel({ params, onParamChange, autoAdjustSliceCount, onToggleAutoAdjust, selectedProtocol }: ParametersPanelProps) {
  const coverage = useMemo(
    () => calculateCoverage(params),
    [params.sliceCount, params.sliceThickness, params.sliceGap]
  );

  const feedback = useMemo(
    () => evaluatePlanningFeedback(params, coverage),
    [coverage, params.sliceThickness, params.sliceGap, params.angulation, params.fovRead]
  );

  const guidance = useMemo(
    () => evaluatePlanningGuidance(params, coverage, selectedProtocol),
    [coverage, params.sliceThickness, params.angulation, selectedProtocol]
  );

  return (
    <aside className="w-64 flex-shrink-0 border-l border-border bg-console-panel flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-primary">
          Parameters
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Section 1: Geometry */}
        <div>
          <h3 className="font-mono text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">Geometry</h3>
          <div className="space-y-5">
            {paramConfigs.map((cfg) => (
              <div key={cfg.key}>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-[11px] font-mono font-medium text-foreground">
                    {cfg.label}
                  </label>
                  <span className="text-[11px] font-mono font-semibold text-primary tabular-nums">
                    {cfg.step < 1 ? params[cfg.key].toFixed(1) : params[cfg.key]}
                    {cfg.unit && (
                      <span className="text-muted-foreground ml-0.5">{cfg.unit}</span>
                    )}
                  </span>
                </div>
                {cfg.key === "sliceCount" && autoAdjustSliceCount && (
                  <p className="text-[9px] font-mono text-primary/70 italic mb-1.5">Auto-adjust enabled</p>
                )}
                <Slider
                  value={[params[cfg.key]]}
                  onValueChange={(val) => onParamChange(cfg.key, val[0])}
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-0 [&_.relative]:h-1.5 [&_.absolute]:bg-primary/70"
                />
              </div>
            ))}

            {/* Coverage within Geometry */}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-[11px] font-mono font-medium text-foreground">Coverage</span>
              <span className="text-[11px] font-mono font-semibold text-primary tabular-nums">
                {coverage.toFixed(1)}
                <span className="text-muted-foreground ml-0.5">mm</span>
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Section 2: Sequence Parameters */}
        <div>
          <h3 className="font-mono text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Sequence Parameters</h3>
          <div className="space-y-2">
            {([
              { label: "TR", value: params.tr, unit: "ms" },
              { label: "TE", value: params.te, unit: "ms" },
              { label: "Flip Angle", value: params.flipAngle, unit: "°" },
            ] as const).map((item) => (
              <div key={item.label} className="flex items-baseline justify-between">
                <span className="text-[11px] font-mono font-medium text-foreground">{item.label}</span>
                <span className="text-[11px] font-mono font-semibold text-primary tabular-nums">
                  {item.value}
                  <span className="text-muted-foreground ml-0.5">{item.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Planning Feedback */}
        {feedback.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div>
              <h3 className="font-mono text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Planning Feedback</h3>
              <div className="space-y-2">
                {feedback.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${f.status === "success" ? "bg-console-success" : "bg-console-warn"}`} />
                    <span className={`text-[10px] font-mono leading-snug ${f.status === "success" ? "text-console-success" : "text-console-warn"}`}>{f.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Planning Guidance */}
      <div className="border-t border-border px-4 py-3">
        <h3 className="font-mono text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">Planning Guidance</h3>
        <div className="space-y-1.5 mb-2">
          {guidance.items.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-foreground/80">{item.label}</span>
              <span className={`text-[10px] font-mono font-semibold ${item.status === "good" ? "text-console-success" : "text-console-warn"}`}>
                {item.status === "good" ? "✓" : "⚠"} {item.text}
              </span>
            </div>
          ))}
        </div>
        <div className="pt-1.5 border-t border-border">
          <span className={`text-[10px] font-mono ${guidance.allGood ? "text-console-success" : "text-console-warn"}`}>
            {guidance.allGood
              ? "Planning appears appropriate for this MRI protocol."
              : "Review highlighted parameters before proceeding."}
          </span>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 space-y-2">
        <button className="w-full py-2 rounded-sm bg-primary/15 text-primary font-mono text-xs font-semibold tracking-wider uppercase hover:bg-primary/25 transition-colors console-glow">
          Apply Changes
        </button>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSdc9HJ7LMjTKijl1_Sbo7Vh4M5FEFdpEj-ZXqvB9o5oMZgICg/viewform?usp=publish-editor"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-1.5 rounded-sm border border-border text-center text-muted-foreground font-mono text-[10px] tracking-wider uppercase hover:text-foreground hover:border-primary/40 transition-colors"
        >
          Send Feedback
        </a>
      </div>
    </aside>
  );
}
