import { describe, it, expect, vi } from "vitest";
import { createPrescriptionOverlayRenderer } from "@/features/imaging/overlays/prescription-overlay-renderer";
import type { PrescriptionProjection } from "@/features/planning/domain/prescription-math";

function makeContext() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
}

const viewport = { width: 400, height: 400 };
const scale = { pxPerMmU: 2, pxPerMmV: 2 };

function makeProjection(overrides: Partial<PrescriptionProjection> = {}): PrescriptionProjection {
  return {
    center: { uMm: 0, vMm: 0 },
    widthMm: 100,
    heightMm: 80,
    rotationDeg: 0,
    sliceLines: [],
    isEdgeOn: false,
    outOfPlaneOffsetMm: 0,
    ...overrides,
  };
}

describe("prescription overlay renderer", () => {
  it("clears before drawing", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", makeProjection(), scale);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 400);
  });

  it("positions the prescription from the projection, not the viewport centre", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(
      ctx,
      viewport,
      "axial",
      makeProjection({ center: { uMm: 25, vMm: 10 } }),
      scale
    );
    // 200 + 25*2 across, 200 - 10*2 down (screen y is inverted).
    expect(ctx.translate).toHaveBeenCalledWith(250, 180);
  });

  it("draws the field of view at the projected size", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", makeProjection(), scale);
    expect(ctx.strokeRect).toHaveBeenCalledWith(-100, -80, 200, 160);
  });

  it("applies in-plane rotation", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(
      ctx,
      viewport,
      "axial",
      makeProjection({ rotationDeg: 90 }),
      scale
    );
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 2);
  });

  it("draws no slice lines face on", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", makeProjection(), scale);
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it("draws every slice boundary edge on", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(
      ctx,
      viewport,
      "coronal",
      makeProjection({
        isEdgeOn: true,
        sliceLines: [
          { start: { uMm: -50, vMm: -6 }, end: { uMm: 50, vMm: -6 } },
          { start: { uMm: -50, vMm: 6 }, end: { uMm: 50, vMm: 6 } },
        ],
      }),
      scale
    );
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
    expect(ctx.moveTo).toHaveBeenCalledWith(100, 212);
    expect(ctx.lineTo).toHaveBeenCalledWith(300, 212);
  });

  it("skips drawing a degenerate prescription", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(
      ctx,
      viewport,
      "axial",
      makeProjection({ widthMm: 0 }),
      scale
    );
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it("skips drawing when the projection is not finite", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(
      ctx,
      viewport,
      "axial",
      makeProjection({ heightMm: Number.NaN }),
      scale
    );
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });
});
