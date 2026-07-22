import { describe, it, expect } from "vitest";
import { toGrayscale } from "@/features/imaging/reslice/intensity-mapping";
import type { ReslicedSlice } from "@/features/imaging/reslice/reslice-volume";

function makeSlice(values: number[], alphaValues?: number[]): ReslicedSlice {
  const intensities = Float32Array.from(values);
  const alpha = Uint8Array.from(alphaValues ?? values.map(() => 255));
  return {
    width: values.length,
    height: 1,
    intensities,
    alpha,
    minIntensity: Math.min(...values),
    maxIntensity: Math.max(...values),
  };
}

const imageOf = (slice: ReslicedSlice, min: number, max: number) => {
  const outcome = toGrayscale(slice, { min, max });
  if (outcome.status !== "ok") throw new Error(outcome.reason);
  return outcome.image;
};

describe("linear grey mapping", () => {
  it("maps the window minimum to black", () => {
    expect(imageOf(makeSlice([0, 50, 100]), 0, 100).gray[0]).toBe(0);
  });

  it("maps the window maximum to white", () => {
    expect(imageOf(makeSlice([0, 50, 100]), 0, 100).gray[2]).toBe(255);
  });

  it("maps the midpoint to mid grey", () => {
    expect(imageOf(makeSlice([0, 50, 100]), 0, 100).gray[1]).toBe(128);
  });

  it("clamps values below and above the window", () => {
    const image = imageOf(makeSlice([-50, 150]), 0, 100);
    expect(image.gray[0]).toBe(0);
    expect(image.gray[1]).toBe(255);
  });

  it("handles a negative window", () => {
    const image = imageOf(makeSlice([-100, -50, 0]), -100, 0);
    expect(image.gray[0]).toBe(0);
    expect(image.gray[2]).toBe(255);
  });

  it("preserves output dimensions", () => {
    const image = imageOf(makeSlice([1, 2, 3]), 0, 10);
    expect(image.width).toBe(3);
    expect(image.height).toBe(1);
    expect(image.gray).toHaveLength(3);
  });
});

describe("alpha handling", () => {
  it("preserves alpha from the slice", () => {
    const image = imageOf(makeSlice([10, 20, 30], [0, 255, 255]), 0, 100);
    expect(Array.from(image.alpha)).toEqual([0, 255, 255]);
  });

  it("leaves transparent pixels transparent and black", () => {
    const image = imageOf(makeSlice([999, 20], [0, 255]), 0, 100);
    expect(image.alpha[0]).toBe(0);
    expect(image.gray[0]).toBe(0);
  });

  it("does not let a transparent pixel brighten the image", () => {
    const image = imageOf(makeSlice([100, 0], [0, 255]), 0, 100);
    expect(image.gray[0]).toBe(0);
  });
});

describe("window validation", () => {
  it("rejects a collapsed window", () => {
    expect(toGrayscale(makeSlice([1]), { min: 5, max: 5 }).status).toBe("invalid-window");
  });

  it("rejects an inverted window", () => {
    expect(toGrayscale(makeSlice([1]), { min: 10, max: 0 }).status).toBe("invalid-window");
  });

  it("rejects a non-finite window", () => {
    expect(toGrayscale(makeSlice([1]), { min: Number.NaN, max: 1 }).status).toBe("invalid-window");
    expect(toGrayscale(makeSlice([1]), { min: 0, max: Infinity }).status).toBe("invalid-window");
  });

  it("treats a non-finite intensity as black rather than propagating it", () => {
    const slice = makeSlice([Number.NaN, 50]);
    expect(imageOf(slice, 0, 100).gray[0]).toBe(0);
  });
});
