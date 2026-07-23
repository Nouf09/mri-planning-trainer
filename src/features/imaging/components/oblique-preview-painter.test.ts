import { describe, it, expect, vi, beforeAll } from "vitest";
import { paintObliquePreview } from "@/features/imaging/components/oblique-preview-painter";
import type { ObliquePreviewImage } from "@/features/imaging/reslice/runtime/oblique-preview.types";

// jsdom lacks a real 2d context and ImageData; provide the minimum the painter uses.
beforeAll(() => {
  if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
    (globalThis as unknown as { ImageData: unknown }).ImageData = class {
      data: Uint8ClampedArray; width: number; height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data; this.width = width; this.height = height;
      }
    };
  }
});

function stubCanvas() {
  const ctx = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    putImageData: vi.fn(),
  };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

function makeImage(): ObliquePreviewImage {
  return {
    width: 2, height: 1,
    gray: Uint8ClampedArray.from([0, 255]),
    alpha: Uint8Array.from([255, 0]),
  };
}

describe("paintObliquePreview", () => {
  it("sizes the canvas to the image", () => {
    const { canvas } = stubCanvas();
    paintObliquePreview(canvas, makeImage());
    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(1);
  });

  it("disables smoothing for exact pixels", () => {
    const { canvas, ctx } = stubCanvas();
    paintObliquePreview(canvas, makeImage());
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it("expands gray and alpha into RGBA", () => {
    const { canvas, ctx } = stubCanvas();
    paintObliquePreview(canvas, makeImage());
    const imageData = ctx.putImageData.mock.calls[0][0] as { data: Uint8ClampedArray };
    expect(Array.from(imageData.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 0]);
  });

  it("does not mutate the source buffers", () => {
    const { canvas } = stubCanvas();
    const image = makeImage();
    paintObliquePreview(canvas, image);
    expect(Array.from(image.gray)).toEqual([0, 255]);
    expect(Array.from(image.alpha)).toEqual([255, 0]);
  });
});
