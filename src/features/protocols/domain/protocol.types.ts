export type ProtocolIconKey =
  | "brain"
  | "scan"
  | "file-text"
  | "zap"
  | "activity";

export interface Protocol {
  name: string;
  iconKey: ProtocolIconKey;
  isPlaceholder?: boolean;
  helperText?: string;
}

export interface ProtocolGroup {
  label: string;
  protocols: Protocol[];
}
