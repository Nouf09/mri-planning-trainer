import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Lightbulb } from "lucide-react";

interface ClinicalCase {
  id: string;
  title: string;
  patient: string;
  symptoms: string;
  clinicalQuestion: string;
  suggestedSequences: string[];
  hint: string;
}

const cases: ClinicalCase[] = [
  {
    id: "stroke",
    title: "Acute Stroke Evaluation",
    patient: "62-year-old male",
    symptoms: "Sudden onset right-sided weakness and difficulty speaking.",
    clinicalQuestion: "Rule out acute ischemic stroke.",
    suggestedSequences: ["DWI", "FLAIR", "T2 Axial"],
    hint: "DWI is the most sensitive sequence for detecting acute ischemia.",
  },
  {
    id: "tumor",
    title: "Brain Tumor Assessment",
    patient: "45-year-old female",
    symptoms: "Persistent headaches and progressive visual disturbance.",
    clinicalQuestion: "Evaluate suspected intracranial tumor.",
    suggestedSequences: ["T1", "T2", "FLAIR", "T1 post-contrast"],
    hint: "T1 post-contrast highlights blood-brain barrier breakdown in tumors.",
  },
  {
    id: "ms",
    title: "Multiple Sclerosis Evaluation",
    patient: "30-year-old female",
    symptoms: "Intermittent blurred vision and limb numbness.",
    clinicalQuestion: "Assess for demyelinating lesions suggestive of multiple sclerosis.",
    suggestedSequences: ["FLAIR", "T2 Axial", "T1"],
    hint: "FLAIR improves visualization of demyelinating lesions.",
  },
];

export function ClinicalCasePanel() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCase = cases.find((c) => c.id === selectedId);

  return (
    <div className="border-b border-border bg-console-panel px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Training Case</span>
        </div>
        <Select value={selectedId ?? ""} onValueChange={(v) => setSelectedId(v || null)}>
          <SelectTrigger className="h-7 w-[260px] text-[11px] font-mono bg-console-dark border-border">
            <SelectValue placeholder="Select a clinical case…" />
          </SelectTrigger>
          <SelectContent className="bg-console-panel border-border">
            {cases.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-[11px] font-mono">
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCase && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-4 text-[10px] font-mono">
          <div className="space-y-1.5">
            <div className="text-primary font-bold text-[11px]">{selectedCase.title}</div>
            <div className="text-muted-foreground">
              <span className="text-foreground/70">Patient:</span> {selectedCase.patient} — {selectedCase.symptoms}
            </div>
            <div className="text-muted-foreground">
              <span className="text-foreground/70">Clinical Question:</span> {selectedCase.clinicalQuestion}
            </div>
            <div className="text-muted-foreground">
              <span className="text-foreground/70">Task:</span>{" "}
              <span className="text-foreground/60 italic">Plan the MRI slices and parameters appropriate for this clinical scenario.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground/70">Sequences:</span>
              {selectedCase.suggestedSequences.map((s) => (
                <span key={s} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[9px]">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-1.5 bg-console-warn/5 border border-console-warn/20 rounded px-2.5 py-1.5 max-w-[240px]">
            <Lightbulb className="h-3 w-3 text-console-warn mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-console-warn font-semibold text-[9px] uppercase tracking-wider mb-0.5">Clinical Hint</div>
              <div className="text-muted-foreground leading-relaxed">{selectedCase.hint}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
