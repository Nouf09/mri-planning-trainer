import type { Patient, Study } from "@/features/planning/domain/planning-session";

/** Fictional identities used by the trainer. No real person is represented. */
export const EDUCATIONAL_PATIENT: Patient = {
  id: "2024-MR-00847",
  name: "DOE, JOHN",
};

export const EDUCATIONAL_STUDY: Study = {
  id: "STUDY-001",
  description: "MRI Brain — Training",
};

export const DEFAULT_SEQUENCE_ID = "sequence-1";
