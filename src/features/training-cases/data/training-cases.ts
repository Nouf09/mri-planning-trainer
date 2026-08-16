import type { ClinicalCase } from "@/features/training-cases/domain/training-case.types";

/**
 * The case a learner starts on.
 *
 * Named here so the catalogue and the session that seeds the selection cannot
 * disagree, and so the default never depends on array order.
 */
export const DEFAULT_CASE_ID = "routine-brain";

/**
 * Synthetic educational scenarios only. Every demographic detail, symptom, and
 * clinical question below is invented and is not based on a real patient record.
 */
export const cases: ClinicalCase[] = [
  {
    id: DEFAULT_CASE_ID,
    title: "Adult Routine Brain MRI",
    patient: "Adult training subject",
    symptoms: "Routine examination. This foundational case carries no clinical scenario.",
    clinicalQuestion:
      "Practise the standard planning workflow for a routine adult brain examination.",
    suggestedSequences: [],
    hint: "Concentrate on the planning workflow itself: orientation, position, coverage, and slice geometry.",
    availability: "available",
  },
  {
    id: "stroke",
    title: "Acute Stroke Evaluation",
    patient: "62-year-old male",
    symptoms: "Sudden onset right-sided weakness and difficulty speaking.",
    clinicalQuestion: "Rule out acute ischemic stroke.",
    suggestedSequences: ["DWI", "FLAIR", "T2 Axial"],
    hint: "DWI is the most sensitive sequence for detecting acute ischemia.",
    availability: "coming-later",
  },
  {
    id: "tumor",
    title: "Brain Tumor Assessment",
    patient: "45-year-old female",
    symptoms: "Persistent headaches and progressive visual disturbance.",
    clinicalQuestion: "Evaluate suspected intracranial tumor.",
    suggestedSequences: ["T1", "T2", "FLAIR", "T1 post-contrast"],
    hint: "T1 post-contrast highlights blood-brain barrier breakdown in tumors.",
    availability: "coming-later",
  },
  {
    id: "ms",
    title: "Multiple Sclerosis Evaluation",
    patient: "30-year-old female",
    symptoms: "Intermittent blurred vision and limb numbness.",
    clinicalQuestion: "Assess for demyelinating lesions suggestive of multiple sclerosis.",
    suggestedSequences: ["FLAIR", "T2 Axial", "T1"],
    hint: "FLAIR improves visualization of demyelinating lesions.",
    availability: "coming-later",
  },
];
