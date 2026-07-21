import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ImagingEngine } from "@/features/imaging/domain/imaging-engine";
import type { VolumeImagingEngine } from "@/features/imaging/domain/volume-imaging-engine";
import type { VolumePosition } from "@/features/imaging/domain/volume-position";
import { useVolumePosition } from "@/features/imaging/hooks/use-volume-position";
import { useVolumeSync } from "@/features/imaging/hooks/use-volume-sync";

interface FakeEngine extends VolumeImagingEngine {
  /** Test helper: simulate a user-driven location change from this viewport. */
  emit(position: VolumePosition): void;
  setPosition: ReturnType<typeof vi.fn>;
}

/**
 * @param echoOnSetPosition simulates a misbehaving engine that reports every
 * programmatic write back as if it were user input.
 */
function createFakeEngine(echoOnSetPosition = false): FakeEngine {
  let listener: ((position: VolumePosition) => void) | null = null;

  const engine = {
    kind: "niivue" as const,
    getBackgroundSource: () => null,
    dispose: vi.fn(),
    mount: vi.fn(async () => undefined),
    loadVolume: vi.fn(async () => undefined),
    setPosition: vi.fn((position: VolumePosition) => {
      if (echoOnSetPosition) listener?.(position);
    }),
    setPositionListener: (next: ((position: VolumePosition) => void) | null) => {
      listener = next;
    },
    getPosition: () => null,
    getCenterPosition: () => ({ x: 50, y: 50, z: 50 }),
    emit: (position: VolumePosition) => listener?.(position),
  };

  return engine as unknown as FakeEngine;
}

const jpgEngine: ImagingEngine = {
  kind: "jpg",
  getBackgroundSource: () => "/mri-axial.jpg",
  dispose: () => undefined,
};

/** Three viewports bound to one shared position, as Index.tsx wires them. */
function useThreeViewports(engines: ImagingEngine[]) {
  const { position, publishPosition } = useVolumePosition();
  const shared = { status: "ready" as const, position, onPositionChange: publishPosition };
  useVolumeSync({ engine: engines[0], ...shared });
  useVolumeSync({ engine: engines[1], ...shared });
  useVolumeSync({ engine: engines[2], ...shared });
  return position;
}

/** A single viewport, for cases where three would only add noise. */
function useOneViewport(engine: ImagingEngine) {
  const { position, publishPosition } = useVolumePosition();
  useVolumeSync({ engine, status: "ready", position, onPositionChange: publishPosition });
  return position;
}

describe("useVolumeSync seeding", () => {
  it("seeds the shared position from the volume centre once ready", () => {
    const engines = [createFakeEngine(), createFakeEngine(), createFakeEngine()];
    const { result } = renderHook(() => useThreeViewports(engines));
    expect(result.current).toEqual({ x: 50, y: 50, z: 50 });
  });

  it("applies the seeded position to every viewport", () => {
    const engines = [createFakeEngine(), createFakeEngine(), createFakeEngine()];
    renderHook(() => useThreeViewports(engines));
    for (const engine of engines) {
      expect(engine.setPosition).toHaveBeenCalledWith({ x: 50, y: 50, z: 50 });
    }
  });

  it("does nothing for an engine that does not render volumes", () => {
    const { result } = renderHook(() => useOneViewport(jpgEngine));
    expect(result.current).toBeNull();
  });

  it("does not seed until the engine is ready", () => {
    const engine = createFakeEngine();
    const { result } = renderHook(() => {
      const { position, publishPosition } = useVolumePosition();
      useVolumeSync({ engine, status: "loading", position, onPositionChange: publishPosition });
      return position;
    });
    expect(result.current).toBeNull();
    expect(engine.setPosition).not.toHaveBeenCalled();
  });
});

describe("useVolumeSync propagation", () => {
  it("propagates a change in one viewport to the other two", () => {
    const engines = [createFakeEngine(), createFakeEngine(), createFakeEngine()];
    const { result } = renderHook(() => useThreeViewports(engines));
    for (const engine of engines) engine.setPosition.mockClear();

    act(() => engines[0].emit({ x: 11, y: 22, z: 33 }));

    expect(result.current).toEqual({ x: 11, y: 22, z: 33 });
    for (const engine of engines) {
      expect(engine.setPosition).toHaveBeenCalledWith({ x: 11, y: 22, z: 33 });
    }
  });

  it("keeps every viewport on the same shared position", () => {
    const engines = [createFakeEngine(), createFakeEngine(), createFakeEngine()];
    renderHook(() => useThreeViewports(engines));

    act(() => engines[2].emit({ x: -5, y: -6, z: -7 }));

    const applied = engines.map(
      (engine) => engine.setPosition.mock.calls.at(-1)?.[0]
    );
    expect(applied[0]).toEqual(applied[1]);
    expect(applied[1]).toEqual(applied[2]);
  });
});

describe("useVolumeSync loop prevention", () => {
  it("applies a user change a bounded number of times per viewport", () => {
    const engines = [createFakeEngine(), createFakeEngine(), createFakeEngine()];
    renderHook(() => useThreeViewports(engines));
    for (const engine of engines) engine.setPosition.mockClear();

    act(() => engines[0].emit({ x: 1, y: 2, z: 3 }));

    for (const engine of engines) {
      expect(engine.setPosition).toHaveBeenCalledTimes(1);
    }
  });

  it("terminates even when every engine echoes programmatic writes", () => {
    const engines = [createFakeEngine(true), createFakeEngine(true), createFakeEngine(true)];
    renderHook(() => useThreeViewports(engines));
    for (const engine of engines) engine.setPosition.mockClear();

    act(() => engines[0].emit({ x: 9, y: 9, z: 9 }));

    // The idempotent publisher stops the echo instead of re-entering.
    for (const engine of engines) {
      expect(engine.setPosition.mock.calls.length).toBeLessThanOrEqual(2);
    }
  });

  it("ignores a repeated identical user change", () => {
    const engines = [createFakeEngine(), createFakeEngine(), createFakeEngine()];
    renderHook(() => useThreeViewports(engines));
    for (const engine of engines) engine.setPosition.mockClear();

    act(() => engines[0].emit({ x: 4, y: 4, z: 4 }));
    act(() => engines[0].emit({ x: 4, y: 4, z: 4 }));

    for (const engine of engines) {
      expect(engine.setPosition).toHaveBeenCalledTimes(1);
    }
  });

  it("clears its listener on unmount", () => {
    const engine = createFakeEngine();
    const { unmount } = renderHook(() => useOneViewport(engine));
    unmount();
    engine.setPosition.mockClear();

    // No listener remains, so this cannot reach React state.
    expect(() => engine.emit({ x: 1, y: 1, z: 1 })).not.toThrow();
    expect(engine.setPosition).not.toHaveBeenCalled();
  });
});
