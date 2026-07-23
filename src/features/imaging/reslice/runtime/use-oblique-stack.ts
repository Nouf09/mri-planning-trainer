import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Prescription } from "@/features/planning/domain/prescription";
import type { ImagingEngineKind } from "@/features/imaging/domain/imaging-engine";
import type { PlanningMode } from "@/features/imaging/data/imaging-config";
import type { ImagingRuntimeCapabilities } from "@/features/imaging/adapters/niivue/volume-sampler-capability";
import type { ObliquePreviewImage } from "@/features/imaging/reslice/runtime/oblique-preview.types";
import {
  buildStackDescriptor,
  centreSliceIndex,
  renderStackSlice,
} from "@/features/imaging/reslice/runtime/build-oblique-stack";
import type { ObliqueStackState } from "@/features/imaging/reslice/runtime/oblique-stack.types";
import {
  createPreviewScheduler,
  type Deferrer,
} from "@/features/imaging/reslice/runtime/oblique-preview-scheduler";

export interface UseObliqueStackInput {
  readonly engineKind: ImagingEngineKind;
  readonly planningMode: PlanningMode;
  readonly prescription: Prescription | null;
  readonly capabilities: ImagingRuntimeCapabilities | null;
  /** Test seam for deterministic scheduling. */
  readonly deferrer?: Deferrer;
}

export interface ObliqueStack {
  readonly state: ObliqueStackState;
  /** Selects a slice by index; clamped, and never touches planning state. */
  selectSlice(index: number): void;
}

const HIDDEN: ObliqueStackState = { status: "hidden" };

function clamp(index: number, count: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.round(index), 0), count - 1);
}

/**
 * Drives the multi-slice stack preview.
 *
 * Geometry (the descriptor) is recomputed only when the prescription or volume
 * capability changes. Selecting a slice renders just that slice, off-render and
 * generation-guarded, and caches it against the descriptor's identity so
 * revisits are instant and no stale render can paint over a newer selection.
 */
export function useObliqueStack(input: UseObliqueStackInput): ObliqueStack {
  const { engineKind, planningMode, prescription, capabilities, deferrer } = input;
  const [state, setState] = useState<ObliqueStackState>(HIDDEN);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scheduler = useMemo(() => createPreviewScheduler(deferrer), [deferrer]);

  const active = engineKind === "niivue" && planningMode === "world";

  // Geometry is rebuilt only when the prescription or capability changes.
  const descriptorResult = useMemo(() => {
    if (!active || !capabilities || !prescription) return null;
    return buildStackDescriptor(prescription, capabilities);
  }, [active, capabilities, prescription]);

  const descriptor = descriptorResult?.status === "ready" ? descriptorResult.descriptor : null;
  const descriptorIdentity = descriptor?.identity ?? null;

  // One cache per descriptor identity; discarded when that identity changes.
  const cacheRef = useRef<{ identity: string; images: Map<number, ObliquePreviewImage> } | null>(null);
  if (descriptorIdentity && cacheRef.current?.identity !== descriptorIdentity) {
    cacheRef.current = { identity: descriptorIdentity, images: new Map() };
  }
  if (!descriptorIdentity) cacheRef.current = null;

  // A new stack (new identity) resets the selection to its centre.
  const lastIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    if (descriptor && lastIdentityRef.current !== descriptor.identity) {
      lastIdentityRef.current = descriptor.identity;
      setSelectedIndex(centreSliceIndex(descriptor.offsetsMm.length));
    }
  }, [descriptor]);

  useEffect(() => {
    if (!active) {
      scheduler.cancel();
      setState(HIDDEN);
      return;
    }
    if (!capabilities) {
      scheduler.cancel();
      setState({ status: "waiting-for-volume" });
      return;
    }
    if (!descriptorResult) return;
    if (descriptorResult.status !== "ready") {
      scheduler.cancel();
      setState(descriptorResult);
      return;
    }

    const activeDescriptor = descriptorResult.descriptor;
    const count = activeDescriptor.offsetsMm.length;
    const index = clamp(selectedIndex, count);

    const cache = cacheRef.current;
    const cached = cache?.identity === activeDescriptor.identity ? cache.images.get(index) : undefined;
    if (cached) {
      scheduler.cancel();
      setState({ status: "ready", sliceCount: count, selectedIndex: index, image: cached, fromCache: true });
      return;
    }

    scheduler.request(
      () => renderStackSlice(activeDescriptor, index),
      (result) => {
        if (result.status !== "ready") {
          setState({ status: "error", message: result.message });
          return;
        }
        if (cacheRef.current?.identity === activeDescriptor.identity) {
          cacheRef.current.images.set(index, result.image);
        }
        setState({ status: "ready", sliceCount: count, selectedIndex: index, image: result.image, fromCache: false });
      }
    );

    return () => scheduler.cancel();
  }, [active, capabilities, descriptorResult, descriptorIdentity, selectedIndex, scheduler]);

  useEffect(() => () => scheduler.cancel(), [scheduler]);

  const selectSlice = useCallback(
    (index: number) => {
      const count = descriptor?.offsetsMm.length ?? 0;
      if (count <= 0) return;
      setSelectedIndex(clamp(index, count));
    },
    [descriptor]
  );

  return { state, selectSlice };
}
