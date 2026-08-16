import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stethoscope, Lightbulb } from "lucide-react";
import { cases } from "@/features/training-cases/data/training-cases";

const COMING_LATER_LABEL = "Advanced — Coming Later";

interface ClinicalCasePanelProps {
  selectedCaseId: string | null;
  onSelectCase: (caseId: string | null) => void;
}

export function ClinicalCasePanel({ selectedCaseId, onSelectCase }: ClinicalCasePanelProps) {
  const selectedCase = cases.find((c) => c.id === selectedCaseId);
  const availableCases = cases.filter((c) => c.availability === "available");
  const comingLaterCases = cases.filter((c) => c.availability === "coming-later");

  return (
    <div className="border-b border-border bg-console-panel px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Training Case</span>
        </div>
        <Select value={selectedCaseId ?? ""} onValueChange={(v) => onSelectCase(v || null)}>
          <SelectTrigger className="h-7 w-[260px] text-[11px] font-mono bg-console-dark border-border">
            <SelectValue placeholder="Select a clinical case…" />
          </SelectTrigger>
          <SelectContent className="bg-console-panel border-border">
            {availableCases.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-[11px] font-mono">
                {c.title}
              </SelectItem>
            ))}
            {comingLaterCases.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                  {COMING_LATER_LABEL}
                </SelectLabel>
                {comingLaterCases.map((c) => (
                  // Natively disabled: Radix marks it aria-disabled, removes it
                  // from keyboard activation, and never fires onValueChange.
                  <SelectItem key={c.id} value={c.id} disabled className="text-[11px] font-mono">
                    {c.title}
                    <span className="ml-2 text-[9px] text-muted-foreground">(coming later)</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
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
            {selectedCase.suggestedSequences.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-foreground/70">Sequences:</span>
                {selectedCase.suggestedSequences.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[9px]">
                    {s}
                  </span>
                ))}
              </div>
            )}
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
