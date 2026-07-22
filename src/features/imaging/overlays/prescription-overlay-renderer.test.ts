import { describe, it, expect, vi } from "vitest";
import { createPrescriptionOverlayRenderer } from "@/features/imaging/overlays/prescription-overlay-renderer";
import {
  EMPTY_PROJECTION,
  type ProjectionResult,
} from "@/features/imaging/projection/projection-model";
import type { ProjectedQuad } from "@/features/imaging/projection/quad";
import { rotateKnobPosition } from "@/features/imaging/projection/hit-test-projection";

function makeContext() {
  return {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    strokeRect: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    strokeStyle: "", fillStyle: "", lineWidth: 0, globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
}

const viewport = { width: 600, height: 600 };

const OUTLINE: ProjectedQuad = [
  { x: 200, y: 200 },
  { x: 400, y: 200 },
  { x: 400, y: 320 },
  { x: 200, y: 320 },
];

const OBLIQUE: ProjectedQuad = [
  { x: 200, y: 200 },
  { x: 380, y: 240 },
  { x: 420, y: 340 },
  { x: 240, y: 300 },
];

function projection(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    mode: "face",
    outline: OUTLINE,
    sliceOutlines: [],
    normalStepPx: { x: 0, y: 0 },
    outOfPlaneOffsetMm: 0,
    isVisible: true,
    ...overrides,
  };
}

describe("prescription overlay renderer", () => {
  it("clears before drawing", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection());
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 600, 600);
  });

  it("strokes the outline corners in order", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection());
    expect(ctx.moveTo).toHaveBeenCalledWith(200, 200);
    expect(ctx.lineTo).toHaveBeenCalledWith(400, 200);
    expect(ctx.lineTo).toHaveBeenCalledWith(400, 320);
    expect(ctx.lineTo).toHaveBeenCalledWith(200, 320);
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it("paints a foreshortened outline exactly as projected", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection({ outline: OBLIQUE }));
    expect(ctx.moveTo).toHaveBeenCalledWith(200, 200);
    expect(ctx.lineTo).toHaveBeenCalledWith(380, 240);
  });

  it("never rotates the canvas, because corners already carry the rotation", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection({ outline: OBLIQUE }));
    expect(ctx.rotate).not.toHaveBeenCalled();
  });

  it("draws each slice outline as its own quad", () => {
    const ctx = makeContext();
    const shifted: ProjectedQuad = OUTLINE.map((c) => ({ x: c.x, y: c.y + 20 })) as unknown as ProjectedQuad;
    createPrescriptionOverlayRenderer().render(ctx, viewport, "coronal", projection({ sliceOutlines: [OUTLINE, shifted] }));
    expect(ctx.moveTo).toHaveBeenCalledWith(200, 220);
  });

  it("draws nothing for an invisible projection", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", EMPTY_PROJECTION);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });
});

describe("prescription overlay handles", () => {
  it("draws only the centre dot by default", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection());
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });

  it("draws four corner handles and a knob when asked", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection(), { showHandles: true });
    expect(ctx.arc).toHaveBeenCalledTimes(6);
  });

  it("places corner handles on the projected corners", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection({ outline: OBLIQUE }), { showHandles: true });
    for (const corner of OBLIQUE) {
      expect(ctx.arc).toHaveBeenCalledWith(corner.x, corner.y, 4, 0, Math.PI * 2);
    }
  });

  it("places the knob where hit testing expects it", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection({ outline: OBLIQUE }), { showHandles: true });
    const knob = rotateKnobPosition(OBLIQUE)!;
    expect(ctx.arc).toHaveBeenCalledWith(knob.x, knob.y, 5, 0, Math.PI * 2);
  });

  it("draws no handles in read-only views", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "coronal", projection());
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });
});
