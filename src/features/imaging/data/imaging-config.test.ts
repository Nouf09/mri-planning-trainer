import { describe, it, expect } from "vitest";
import {
  DEFAULT_IMAGING_ENGINE,
  DEFAULT_PLANNING_MODE,
  resolveEffectivePlanningMode,
  resolveImagingEngineKind,
  resolvePlanningMode,
  type PlanningMode,
} from "@/features/imaging/data/imaging-config";

function withSearch(search: string, run: () => void) {
  const original = window.location.search;
  window.history.pushState({}, "", search || "/");
  try {
    run();
  } finally {
    window.history.pushState({}, "", original || "/");
  }
}

describe("planning mode defaults", () => {
  it("defaults to the legacy planning path", () => {
    expect(DEFAULT_PLANNING_MODE).toBe("legacy");
    expect(DEFAULT_IMAGING_ENGINE).toBe("jpg");
  });
});

describe("resolvePlanningMode", () => {
  it("opts into world planning with the flag", () => {
    withSearch("/?planning=world", () => expect(resolvePlanningMode()).toBe("world"));
  });

  it("keeps the default without the flag", () => {
    withSearch("/", () => expect(resolvePlanningMode()).toBe("legacy"));
  });

  it("ignores an unrecognised value", () => {
    withSearch("/?planning=banana", () => expect(resolvePlanningMode()).toBe("legacy"));
  });

  it("does not disturb engine selection", () => {
    withSearch("/?planning=world&engine=niivue", () => {
      expect(resolvePlanningMode()).toBe("world");
      expect(resolveImagingEngineKind()).toBe("niivue");
    });
  });
});

describe("resolveEffectivePlanningMode", () => {
  it("enables world planning for the JPG source", () => {
    expect(resolveEffectivePlanningMode("world", "jpg", true)).toBe("world");
  });

  it("enables world planning for a volume once its geometry is known", () => {
    expect(resolveEffectivePlanningMode("world", "niivue", true)).toBe("world");
  });

  it("falls back while a volume has no geometry yet", () => {
    // A synthetic extent must never stand in for real anatomy.
    expect(resolveEffectivePlanningMode("world", "niivue", false)).toBe("legacy");
  });

  it("falls back when the JPG source somehow has no bounds", () => {
    expect(resolveEffectivePlanningMode("world", "jpg", false)).toBe("legacy");
  });

  it("leaves legacy requests untouched", () => {
    expect(resolveEffectivePlanningMode("legacy", "jpg", true)).toBe("legacy");
    expect(resolveEffectivePlanningMode("legacy", "niivue", true)).toBe("legacy");
  });

  it("falls back for any unknown engine", () => {
    expect(resolveEffectivePlanningMode("world", "bogus" as never, true)).toBe("legacy");
  });

  it("never returns world for an unknown requested mode", () => {
    expect(resolveEffectivePlanningMode("bogus" as PlanningMode, "jpg", true)).toBe("legacy");
  });
});
