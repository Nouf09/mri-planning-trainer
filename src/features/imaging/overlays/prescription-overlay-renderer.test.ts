import { describe, it, expect, vi } from "vitest";
import { createPrescriptionOverlayRenderer } from "@/features/imaging/overlays/prescription-overlay-renderer";
import {
  EMPTY_PROJECTION,
  type ProjectionResult,
} from "@/features/imaging/projection/projection-model";

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

function faceProjection(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    mode: "face",
    rectangle: { center: { x: 250, y: 180 }, widthPx: 200, heightPx: 160, rotationRad: 0 },
    slab: null,
    sliceLines: [],
    outOfPlaneOffsetMm: 0,
    isVisible: true,
    ...overrides,
  };
}

function edgeProjection(): ProjectionResult {
  return {
    mode: "edge",
    rectangle: null,
    slab: {
      center: { x: 200, y: 200 },
      widthPx: 200,
      heightPx: 24,
      rotationRad: 0,
      thicknessPx: 24,
    },
    sliceLines: [
      { start: { x: 100, y: 212 }, end: { x: 300, y: 212 } },
      { start: { x: 100, y: 188 }, end: { x: 300, y: 188 } },
    ],
    outOfPlaneOffsetMm: 0,
    isVisible: true,
  };
}

describe("prescription overlay renderer", () => {
  it("clears before drawing", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", faceProjection());
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 400);
  });

  it("paints the rectangle where the projection puts it", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", faceProjection());
    expect(ctx.translate).toHaveBeenCalledWith(250, 180);
    expect(ctx.strokeRect).toHaveBeenCalledWith(-100, -80, 200, 160);
  });

  it("applies the rotation it is given without adjusting it", () => {
    const ctx = makeContext();
    const projection = faceProjection({
      rectangle: { center: { x: 200, y: 200 }, widthPx: 100, heightPx: 100, rotationRad: -Math.PI / 2 },
    });
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection);
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 2);
  });

  it("draws no slice lines when there are none", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", faceProjection());
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it("paints the slab and its slice boundaries edge on", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "coronal", edgeProjection());
    expect(ctx.translate).toHaveBeenCalledWith(200, 200);
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
    expect(ctx.moveTo).toHaveBeenCalledWith(100, 212);
    expect(ctx.lineTo).toHaveBeenCalledWith(300, 212);
  });

  it("draws nothing for an invisible projection", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", EMPTY_PROJECTION);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it("draws nothing when no shape is supplied", () => {
    const ctx = makeContext();
    const projection = faceProjection({ rectangle: null });
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection);
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it("performs no geometry of its own", () => {
    const ctx = makeContext();
    const projection = faceProjection();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", projection);
    // Coordinates are painted exactly as provided.
    expect(ctx.translate).toHaveBeenCalledWith(
      projection.rectangle!.center.x,
      projection.rectangle!.center.y
    );
  });
});

describe("prescription overlay handles", () => {
  it("draws no handles by default", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", faceProjection());
    // Only the centre dot is filled.
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });

  it("draws four corner handles and a rotate knob when asked", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", faceProjection(), {
      showHandles: true,
    });
    // Centre dot + four corners + rotate knob.
    expect(ctx.arc).toHaveBeenCalledTimes(6);
  });

  it("places corner handles on the drawn rectangle", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", faceProjection(), {
      showHandles: true,
    });
    expect(ctx.arc).toHaveBeenCalledWith(-100, -80, 4, 0, Math.PI * 2);
    expect(ctx.arc).toHaveBeenCalledWith(100, 80, 4, 0, Math.PI * 2);
  });

  it("draws the rotate stalk above the top edge", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", faceProjection(), {
      showHandles: true,
    });
    expect(ctx.moveTo).toHaveBeenCalledWith(0, -80);
    expect(ctx.lineTo).toHaveBeenCalledWith(0, -100);
    expect(ctx.arc).toHaveBeenCalledWith(0, -100, 5, 0, Math.PI * 2);
  });

  it("draws no handles on a read-only edge-on slab", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "coronal", edgeProjection());
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });

  it("draws no handles for an invisible projection", () => {
    const ctx = makeContext();
    createPrescriptionOverlayRenderer().render(ctx, viewport, "axial", EMPTY_PROJECTION, {
      showHandles: true,
    });
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
