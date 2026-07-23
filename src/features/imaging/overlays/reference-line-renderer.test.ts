import { describe, it, expect } from "vitest";
import type { ProjectedQuad } from "@/features/imaging/projection/quad";
import {
  REFERENCE_LINE_COLOR,
  createReferenceLineRenderer,
} from "@/features/imaging/overlays/reference-line-renderer";

function fakeCtx() {
  const calls: string[] = [];
  const ctx = {
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    closePath: () => calls.push("closePath"),
    stroke: () => calls.push("stroke"),
    set strokeStyle(v: string) {
      calls.push(`strokeStyle=${v}`);
    },
    set lineWidth(v: number) {
      calls.push(`lineWidth=${v}`);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const face: ProjectedQuad = [
  { x: 10, y: 10 },
  { x: 30, y: 10 },
  { x: 30, y: 40 },
  { x: 10, y: 40 },
];

describe("reference line renderer", () => {
  it("strokes a closed path through the four corners in order", () => {
    const { ctx, calls } = fakeCtx();
    createReferenceLineRenderer().render(ctx, face);
    expect(calls).toEqual([
      "save",
      `strokeStyle=${REFERENCE_LINE_COLOR}`,
      "lineWidth=2",
      "beginPath",
      "moveTo:10,10",
      "lineTo:30,10",
      "lineTo:30,40",
      "lineTo:10,40",
      "closePath",
      "stroke",
      "restore",
    ]);
  });

  it("draws nothing when no slice is selected", () => {
    const { ctx, calls } = fakeCtx();
    const renderer = createReferenceLineRenderer();
    renderer.render(ctx, null);
    renderer.render(ctx, undefined);
    expect(calls).toEqual([]);
  });

  it("draws nothing for a non-finite outline", () => {
    const { ctx, calls } = fakeCtx();
    const broken: ProjectedQuad = [
      { x: Number.NaN, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    createReferenceLineRenderer().render(ctx, broken);
    expect(calls).toEqual([]);
  });

  it("still strokes an edge-on (collapsed) outline, which is the line to show", () => {
    const { ctx, calls } = fakeCtx();
    const edge: ProjectedQuad = [
      { x: 20, y: 5 },
      { x: 20, y: 5 },
      { x: 20, y: 45 },
      { x: 20, y: 45 },
    ];
    createReferenceLineRenderer().render(ctx, edge);
    expect(calls).toContain("stroke");
    expect(calls).toContain("moveTo:20,5");
    expect(calls).toContain("lineTo:20,45");
  });

  it("draws different paths for different selected slices (navigation update)", () => {
    const renderer = createReferenceLineRenderer();
    const a = fakeCtx();
    const b = fakeCtx();
    const other: ProjectedQuad = [
      { x: 12, y: 12 },
      { x: 32, y: 12 },
      { x: 32, y: 42 },
      { x: 12, y: 42 },
    ];
    renderer.render(a.ctx, face);
    renderer.render(b.ctx, other);
    expect(a.calls).not.toEqual(b.calls);
  });
});
