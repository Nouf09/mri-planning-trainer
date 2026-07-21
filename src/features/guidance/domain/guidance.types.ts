export interface FeedbackItem {
  msg: string;
  status: "success" | "warn";
}

export interface GuidanceItem {
  label: string;
  status: "good" | "warn";
  text: string;
}

export interface GuidanceResult {
  items: GuidanceItem[];
  allGood: boolean;
}
