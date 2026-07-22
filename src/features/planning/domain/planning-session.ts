import {
  boundsCenter,
  boundsSize,
  type WorldBounds,
} from "@/features/imaging/domain/volume-geometry";
import { AXIAL } from "@/features/planning/domain/orientation";
import {
  NEUTRAL_ORIENTATION_INPUT,
  orientationFromAngles,
  type PrescriptionOrientationInput,
} from "@/features/planning/domain/prescription-orientation";
import type { Prescription } from "@/features/planning/domain/prescription";

/** Fictional identity for the training scenario. Never a real person. */
export interface Patient {
  id: string;
  name: string;
}

export interface Study {
  id: string;
  description: string;
}

export interface Sequence {
  id: string;
  name: string;
  protocolName: string;
  prescription: Prescription;
}

/**
 * The planning workflow's aggregate: who is being scanned, in which study,
 * with which sequences planned.
 *
 * During migration this is derived from the existing planning state rather than
 * owning it, so there is exactly one source of truth.
 */
export interface PlanningSession {
  patient: Patient;
  study: Study;
  sequences: Sequence[];
  activeSequenceId: string | null;
}

export interface PlanningSessionInput {
  patient: Patient;
  study: Study;
  sequenceId: string;
  protocolName: string;
  /** Physical extent of the active image source. */
  bounds: WorldBounds;
  /** Normalized viewport centre carried by the legacy planning state, 0..1. */
  centerX: number;
  centerY: number;
  orientation: PrescriptionOrientationInput;
  fovRead: number;
  fovPhase: number;
  sliceThickness: number;
  sliceGap: number;
  sliceCount: number;
}

/**
 * Places the legacy normalized centre into world millimetres.
 *
 * The viewport's horizontal axis maps to +x and its vertical axis to +y, with
 * screen-down being posterior, which is why the vertical term is inverted. The
 * slice group sits at the depth centre of the image source.
 *
 * Because this works from the active bounds, the same mapping serves both the
 * synthetic JPG extent and a real volume's measured extent.
 */
function centerInWorld(input: PlanningSessionInput) {
  const { bounds, centerX, centerY } = input;
  const size = boundsSize(bounds);
  return {
    x: bounds.min.x + centerX * size.x,
    y: bounds.max.y - centerY * size.y,
    z: boundsCenter(bounds).z,
  };
}

export function toPlanningSession(input: PlanningSessionInput): PlanningSession {
  const orientation = orientationFromAngles(input.orientation ?? NEUTRAL_ORIENTATION_INPUT) ?? AXIAL;

  const prescription: Prescription = {
    center: centerInWorld(input),
    orientation,
    fovRead: input.fovRead,
    fovPhase: input.fovPhase,
    sliceThickness: input.sliceThickness,
    sliceGap: input.sliceGap,
    sliceCount: input.sliceCount,
  };

  return {
    patient: input.patient,
    study: input.study,
    sequences: [
      {
        id: input.sequenceId,
        name: input.protocolName,
        protocolName: input.protocolName,
        prescription,
      },
    ],
    activeSequenceId: input.sequenceId,
  };
}

export function activeSequence(session: PlanningSession): Sequence | null {
  return session.sequences.find((s) => s.id === session.activeSequenceId) ?? null;
}
