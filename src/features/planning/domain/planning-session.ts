import type { SyntheticWorldDescriptor } from "@/features/imaging/domain/synthetic-world";
import { AXIAL, withInPlaneRotation } from "@/features/planning/domain/orientation";
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
  world: SyntheticWorldDescriptor;
  /** Normalized viewport centre carried by the legacy planning state, 0..1. */
  centerX: number;
  centerY: number;
  angulation: number;
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
 * slice group sits at the descriptor's depth centre.
 */
function centerInWorld(input: PlanningSessionInput) {
  const { world, centerX, centerY } = input;
  return {
    x: world.center.x + (centerX - 0.5) * world.widthMm,
    y: world.center.y + (0.5 - centerY) * world.heightMm,
    z: world.center.z,
  };
}

export function toPlanningSession(input: PlanningSessionInput): PlanningSession {
  const orientation = withInPlaneRotation(AXIAL, input.angulation) ?? AXIAL;

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
