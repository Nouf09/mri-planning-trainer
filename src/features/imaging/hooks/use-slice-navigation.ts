import { useEffect, useRef, type RefObject } from "react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { AnatomicalPlane } from "@/features/imaging/domain/viewport.types";
import type { ImagingEngineStatus } from "@/features/imaging/domain/volume.types";
import { isVolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";
import {
  normalizeWheelDeltaY,
  sliceStepsFromWheel,
} from "@/features/imaging/domain/slice-navigation";

interface SliceNavigationOptions {
  engine: ImagingEngine;
  status: ImagingEngineStatus;
  plane: AnatomicalPlane;
  /** Element that owns pointer input for this viewport. */
  targetRef: RefObject<HTMLElement>;
}

/**
 * Forwards wheel navigation from the interaction layer into the imaging engine.
 *
 * The overlay sits above the engine's canvas and owns pointer input, so wheel
 * events never reach the engine on their own. Rather than reordering layers,
 * the overlay forwards them explicitly and React stays in control.
 */
export function useSliceNavigation({
  engine,
  status,
  plane,
  targetRef,
}: SliceNavigationOptions): void {
  const carryRef = useRef(0);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    if (!isVolumeImagingEngine(engine) || status !== "ready") return;

    carryRef.current = 0;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const deltaY = normalizeWheelDeltaY(event.deltaY, event.deltaMode);
      const { steps, carry } = sliceStepsFromWheel(carryRef.current, deltaY);
      carryRef.current = carry;
      if (steps !== 0) engine.stepSlice(plane, steps);
    };

    // Registered natively and non-passively: React attaches wheel listeners
    // passively at the root, where preventDefault would be ignored and the
    // page would scroll behind the viewport.
    target.addEventListener("wheel", handleWheel, { passive: false });
    return () => target.removeEventListener("wheel", handleWheel);
  }, [engine, status, plane, targetRef]);
}
