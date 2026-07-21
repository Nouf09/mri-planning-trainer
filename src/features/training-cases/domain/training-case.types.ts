export interface ClinicalCase {
  id: string;
  title: string;
  patient: string;
  symptoms: string;
  clinicalQuestion: string;
  suggestedSequences: string[];
  hint: string;
}
