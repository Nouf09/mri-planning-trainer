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
    expect(resolveEffectivePlanningMode("world", "jpg")).toBe("world");
  });

  it("falls back to legacy for a real volume", () => {
    // A synthetic descriptor must never be applied to real anatomy.
    expect(resolveEffectivePlanningMode("world", "niivue")).toBe("legacy");
  });

  it("leaves legacy requests untouched", () => {
    expect(resolveEffectivePlanningMode("legacy", "jpg")).toBe("legacy");
    expect(resolveEffectivePlanningMode("legacy", "niivue")).toBe("legacy");
  });

  it("falls back for any unknown engine", () => {
    expect(resolveEffectivePlanningMode("world", "bogus" as never)).toBe("legacy");
  });

  it("never returns world for an unknown requested mode", () => {
    expect(resolveEffectivePlanningMode("bogus" as PlanningMode, "jpg")).toBe("legacy");
  });
});
