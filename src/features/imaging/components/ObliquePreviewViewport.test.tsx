import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { ObliquePreviewViewport } from "@/features/imaging/components/ObliquePreviewViewport";
import type { ObliquePreviewState } from "@/features/imaging/reslice/runtime/oblique-preview.types";

const putImageData = vi.fn();
beforeAll(() => {
  if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
    (globalThis as unknown as { ImageData: unknown }).ImageData = class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  }
  // jsdom has no 2d context; provide a stub so the painter can run.
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => ({ imageSmoothingEnabled: true, clearRect: vi.fn(), putImageData }),
  });
});

const readyState: ObliquePreviewState = {
  status: "ready",
  image: { width: 2, height: 2, gray: Uint8ClampedArray.from([0, 64, 128, 255]), alpha: Uint8Array.from([255, 255, 255, 255]) },
};

describe("ObliquePreviewViewport", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(createElement(ObliquePreviewViewport, { state: { status: "hidden" } }));
    expect(container.firstChild).toBeNull();
  });

  it("shows the approved title and secondary label", () => {
    const { getByText } = render(createElement(ObliquePreviewViewport, { state: { status: "waiting-for-volume" } }));
    expect(getByText("Oblique Preview")).toBeTruthy();
    expect(getByText("Planned centre slice")).toBeTruthy();
  });

  it("shows the waiting message without a canvas", () => {
    const { getByText, container } = render(createElement(ObliquePreviewViewport, { state: { status: "waiting-for-volume" } }));
    expect(getByText(/Load a Niivue volume/)).toBeTruthy();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("shows an unsupported message and no canvas", () => {
    const { getByText, container } = render(
      createElement(ObliquePreviewViewport, { state: { status: "unsupported", message: "unavailable geometry" } })
    );
    expect(getByText("unavailable geometry")).toBeTruthy();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("paints pixels when ready", () => {
    putImageData.mockClear();
    const { container } = render(createElement(ObliquePreviewViewport, { state: readyState }));
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(putImageData).toHaveBeenCalledTimes(1);
  });

  it("registers no interaction handlers on the canvas", () => {
    const { container } = render(createElement(ObliquePreviewViewport, { state: readyState }));
    const canvas = container.querySelector("canvas")!;
    for (const attr of ["onclick", "onmousedown", "onmousemove", "onwheel"]) {
      expect(canvas.getAttribute(attr)).toBeNull();
    }
  });

  it("removes the canvas (no stale pixels) when leaving ready", () => {
    const { container, rerender } = render(createElement(ObliquePreviewViewport, { state: readyState }));
    expect(container.querySelector("canvas")).not.toBeNull();
    rerender(createElement(ObliquePreviewViewport, { state: { status: "unsupported", message: "gone" } }));
    expect(container.querySelector("canvas")).toBeNull();
  });
});
