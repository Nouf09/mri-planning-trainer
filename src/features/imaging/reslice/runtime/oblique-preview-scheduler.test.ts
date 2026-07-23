import { describe, it, expect, vi } from "vitest";
import { createPreviewScheduler, type Deferrer } from "@/features/imaging/reslice/runtime/oblique-preview-scheduler";

/** A deferrer that lets the test decide when queued work runs. */
function manualDeferrer() {
  const queue = new Map<number, () => void>();
  let next = 1;
  const deferrer: Deferrer = {
    schedule: (run) => { const id = next++; queue.set(id, run); return id; },
    cancel: (id) => { queue.delete(id); },
  };
  return { deferrer, flush: () => { for (const [id, run] of [...queue]) { queue.delete(id); run(); } } };
}

describe("preview scheduler", () => {
  it("runs and publishes deferred work", () => {
    const { deferrer, flush } = manualDeferrer();
    const scheduler = createPreviewScheduler(deferrer);
    const publish = vi.fn();
    scheduler.request(() => 42, publish);
    expect(publish).not.toHaveBeenCalled(); // not during the call
    flush();
    expect(publish).toHaveBeenCalledWith(42);
  });

  it("coalesces: only the latest request publishes", () => {
    const { deferrer, flush } = manualDeferrer();
    const scheduler = createPreviewScheduler(deferrer);
    const publish = vi.fn();
    scheduler.request(() => "a", publish);
    scheduler.request(() => "b", publish);
    scheduler.request(() => "c", publish);
    flush();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith("c");
  });

  it("does not publish cancelled work", () => {
    const { deferrer, flush } = manualDeferrer();
    const scheduler = createPreviewScheduler(deferrer);
    const publish = vi.fn();
    scheduler.request(() => 1, publish);
    scheduler.cancel();
    flush();
    expect(publish).not.toHaveBeenCalled();
  });

  it("discards a stale result if a newer request supersedes it during flush", () => {
    const { deferrer, flush } = manualDeferrer();
    const scheduler = createPreviewScheduler(deferrer);
    const results: string[] = [];
    const work = (label: string) => () => { scheduler.request(() => "newer", (r) => results.push(r)); return label; };
    scheduler.request(work("older"), (r) => results.push(r));
    flush(); // the older work schedules newer; older must not publish
    flush(); // newer publishes
    expect(results).toEqual(["newer"]);
  });
});
