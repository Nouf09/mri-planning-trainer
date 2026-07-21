import type { ProtocolGroup } from "@/features/protocols/domain/protocol.types";

export const protocolGroups: ProtocolGroup[] = [
  {
    label: "Brain",
    protocols: [
      { name: "Localizer (3-plane)", iconKey: "scan", isPlaceholder: true, helperText: "Three-plane localizer should be acquired before planning diagnostic sequences." },
      { name: "T2 AXIAL", iconKey: "brain" },
      { name: "T2 FLAIR", iconKey: "brain" },
      { name: "DWI", iconKey: "zap", helperText: "ADC map generated automatically" },
      { name: "T1 MPRAGE", iconKey: "brain" },
      { name: "T2* GRE", iconKey: "activity" },
      { name: "MRA TOF", iconKey: "scan" },
    ],
  },
  {
    label: "Spine",
    protocols: [
      { name: "T1 Sagittal", iconKey: "file-text" },
      { name: "T2 Sagittal", iconKey: "file-text" },
      { name: "STIR", iconKey: "zap" },
    ],
  },
  {
    label: "MSK",
    protocols: [
      { name: "PD FS", iconKey: "scan" },
      { name: "T1 Coronal", iconKey: "file-text" },
      { name: "T2 Axial", iconKey: "file-text" },
    ],
  },
];
