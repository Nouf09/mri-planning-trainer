/**
 * Whether a training case can be worked on yet.
 *
 * Stated in the catalogue data rather than inferred from a title or hardcoded
 * in a component, so one place decides what a learner may open.
 */
export type CaseAvailability = "available" | "coming-later";

export interface ClinicalCase {
  id: string;
  title: string;
  patient: string;
  symptoms: string;
  clinicalQuestion: string;
  suggestedSequences: string[];
  hint: string;
  availability: CaseAvailability;
}
