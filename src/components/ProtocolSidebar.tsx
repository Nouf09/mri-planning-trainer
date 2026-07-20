import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  Scan,
  FileText,
  Zap,
  Activity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface Protocol {
  name: string;
  icon: React.ReactNode;
  isPlaceholder?: boolean;
  helperText?: string;
}

interface ProtocolGroup {
  label: string;
  protocols: Protocol[];
}

const protocolGroups: ProtocolGroup[] = [
  {
    label: "Brain",
    protocols: [
      { name: "Localizer (3-plane)", icon: <Scan className="h-3.5 w-3.5" />, isPlaceholder: true, helperText: "Three-plane localizer should be acquired before planning diagnostic sequences." },
      { name: "T2 AXIAL", icon: <Brain className="h-3.5 w-3.5" /> },
      { name: "T2 FLAIR", icon: <Brain className="h-3.5 w-3.5" /> },
      { name: "DWI", icon: <Zap className="h-3.5 w-3.5" />, helperText: "ADC map generated automatically" },
      { name: "T1 MPRAGE", icon: <Brain className="h-3.5 w-3.5" /> },
      { name: "T2* GRE", icon: <Activity className="h-3.5 w-3.5" /> },
      { name: "MRA TOF", icon: <Scan className="h-3.5 w-3.5" /> },
    ],
  },
  {
    label: "Spine",
    protocols: [
      { name: "T1 Sagittal", icon: <FileText className="h-3.5 w-3.5" /> },
      { name: "T2 Sagittal", icon: <FileText className="h-3.5 w-3.5" /> },
      { name: "STIR", icon: <Zap className="h-3.5 w-3.5" /> },
    ],
  },
  {
    label: "MSK",
    protocols: [
      { name: "PD FS", icon: <Scan className="h-3.5 w-3.5" /> },
      { name: "T1 Coronal", icon: <FileText className="h-3.5 w-3.5" /> },
      { name: "T2 Axial", icon: <FileText className="h-3.5 w-3.5" /> },
    ],
  },
];

interface ProtocolSidebarProps {
  selected: string;
  onSelect: (name: string) => void;
}

export function ProtocolSidebar({ selected, onSelect }: ProtocolSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Brain: true,
    Spine: false,
    MSK: false,
  });

  const toggleGroup = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-56 flex-shrink-0 border-r border-border bg-console-panel flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-primary">
          Protocols
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {protocolGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded[group.label] ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {group.label}
            </button>

            {expanded[group.label] && (
              <div className="space-y-0.5 px-2">
                {group.protocols.map((proto) =>
                  proto.isPlaceholder ? (
                    <div key={proto.name} className="px-3 py-1.5">
                      <div className="flex items-center gap-2.5 text-xs font-mono text-muted-foreground/60">
                        {proto.icon}
                        <span className="italic">{proto.name}</span>
                      </div>
                      {proto.helperText && (
                        <p className="text-[9px] font-mono text-muted-foreground/40 italic mt-1 ml-6 leading-snug">
                          {proto.helperText}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      key={proto.name}
                      onClick={() => onSelect(proto.name)}
                      className={cn(
                        "w-full flex flex-col px-3 py-1.5 rounded-sm text-xs font-mono transition-all",
                        selected === proto.name
                          ? "bg-primary/15 text-primary console-glow"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {proto.icon}
                        {proto.name}
                      </div>
                      {proto.helperText && (
                        <p className="text-[9px] font-mono text-muted-foreground/50 italic mt-0.5 ml-6 leading-snug">
                          {proto.helperText}
                        </p>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-console-success animate-pulse-glow" />
          <span className="text-[10px] font-mono text-muted-foreground">
            SYSTEM READY
          </span>
        </div>
      </div>
    </aside>
  );
}
