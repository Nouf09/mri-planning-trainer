import { describe, it, expect } from "vitest";
import { createPlanningOverlayRenderer } from "@/features/imaging/overlays/planning-overlay-renderer";
import type { PlanningGeometry } from "@/features/imaging/domain/overlay.types";
import type { ViewportSize } from "@/features/imaging/domain/viewport.types";

const viewport: ViewportSize = { width: 500, height: 500 };

const geometry: PlanningGeometry = {
  centerX: 0.5,
  centerY: 0.5,
  fovRead: 230,
  fovPhase: 230,
  angulation: 0,
  sliceCount: 30,
  sliceThickness: 5,
  sliceGap: 1,
};

const MAX_FOV = 500;

/** Mirrors the renderer's own geometry so expectations are derived, not hardcoded. */
function localToViewport(g: PlanningGeometry, v: ViewportSize, lx: number, ly: number) {
  const cx = g.centerX * v.width;
  const cy = g.centerY * v.height;
  const angle = (g.angulation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
}

function fovSize(g: PlanningGeometry, v: ViewportSize) {
  return {
    fovW: (g.fovRead / MAX_FOV) * v.width * 0.8,
    fovH: (g.fovPhase / MAX_FOV) * v.height * 0.8,
  };
}

describe("planning overlay hitTest", () => {
  const renderer = createPlanningOverlayRenderer();

  it("reports 'move' at the prescription centre", () => {
    const point = localToViewport(geometry, viewport, 0, 0);
    expect(renderer.hitTest(point, viewport, "axial", geometry)).toBe("move");
  });

  it("reports 'resize' on each FOV corner", () => {
    const { fovW, fovH } = fovSize(geometry, viewport);
    const corners: [number, number][] = [
      [-fovW / 2, -fovH / 2],
      [fovW / 2, -fovH / 2],
      [fovW / 2, fovH / 2],
      [-fovW / 2, fovH / 2],
    ];
    for (const [lx, ly] of corners) {
      const point = localToViewport(geometry, viewport, lx, ly);
      expect(renderer.hitTest(point, viewport, "axial", geometry)).toBe("resize");
    }
  });

  it("reports 'rotate' on the rotate handle", () => {
    const { fovH } = fovSize(geometry, viewport);
    const point = localToViewport(geometry, viewport, 0, -fovH / 2 - 20);
    expect(renderer.hitTest(point, viewport, "axial", geometry)).toBe("rotate");
  });

  it("reports null far outside the prescription", () => {
    expect(renderer.hitTest({ x: 5, y: 5 }, viewport, "axial", geometry)).toBeNull();
  });

  it("rotates the hit zones with angulation", () => {
    const angulated: PlanningGeometry = { ...geometry, angulation: 90 };
    const { fovH } = fovSize(angulated, viewport);

    // The rotate handle follows the angulation.
    const rotated = localToViewport(angulated, viewport, 0, -fovH / 2 - 20);
    expect(renderer.hitTest(rotated, viewport, "axial", angulated)).toBe("rotate");

    // The same viewport point is not the handle when angulation is zero.
    expect(renderer.hitTest(rotated, viewport, "axial", geometry)).not.toBe("rotate");
  });

  it("ignores the plane argument for hit classification", () => {
    const point = localToViewport(geometry, viewport, 0, 0);
    expect(renderer.hitTest(point, viewport, "sagittal", geometry)).toBe("move");
    expect(renderer.hitTest(point, viewport, "coronal", geometry)).toBe("move");
  });
});
