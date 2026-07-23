/**
 * Coalesces rapid recompute requests into one deferred run and guards against
 * stale publication.
 *
 * A monotonic generation is captured when work is scheduled; the run only
 * publishes if its generation is still current. The deferral mechanism is
 * injectable so tests can drive it deterministically and a future Worker can
 * replace it without changing these semantics.
 */
export interface Deferrer {
  schedule(run: () => void): number;
  cancel(handle: number): void;
}

export const rafDeferrer: Deferrer = {
  schedule: (run) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(() => run())
      : (setTimeout(run, 0) as unknown as number),
  cancel: (handle) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
    else clearTimeout(handle);
  },
};

export interface PreviewScheduler {
  /** Runs `work` on the next frame, publishing only if still current. */
  request<T>(work: () => T, publish: (result: T) => void): void;
  /** Invalidates any pending work so it can never publish. */
  cancel(): void;
}

export function createPreviewScheduler(deferrer: Deferrer = rafDeferrer): PreviewScheduler {
  let generation = 0;
  let handle: number | null = null;

  const clearHandle = () => {
    if (handle !== null) {
      deferrer.cancel(handle);
      handle = null;
    }
  };

  return {
    request<T>(work: () => T, publish: (result: T) => void): void {
      generation += 1;
      const current = generation;
      clearHandle();
      handle = deferrer.schedule(() => {
        handle = null;
        if (current !== generation) return; // superseded
        const result = work();
        if (current !== generation) return; // superseded during work
        publish(result);
      });
    },
    cancel(): void {
      generation += 1; // any in-flight run is now stale
      clearHandle();
    },
  };
}
