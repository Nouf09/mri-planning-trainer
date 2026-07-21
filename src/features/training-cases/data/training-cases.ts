import type { ClinicalCase } from "@/features/training-cases/domain/training-case.types";

export const cases: ClinicalCase[] = [
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
