import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ObliqueStackViewport } from "@/features/imaging/components/ObliqueStackViewport";
import type { ObliqueStackState } from "@/features/imaging/reslice/runtime/oblique-stack.types";
import type { AnatomicalDirection } from "@/features/imaging/domain/anatomical-direction";

const putImageData = vi.fn();
beforeAll(() => {
  if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
    (globalThis as unknown as { ImageData: unknown }).ImageData = class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} };
  }
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: () => ({ imageSmoothingEnabled: true, clearRect: vi.fn(), putImageData }) });
});

const SUPERIOR: AnatomicalDirection = { code: "S", description: "Superior" };

function ready(
  selectedIndex = 7,
  sliceCount = 15,
  offsetMm = 12.5,
  offsetDirection: AnatomicalDirection | null = SUPERIOR
): ObliqueStackState {
  return { status: "ready", sliceCount, selectedIndex, offsetMm, offsetDirection, fromCache: false, image: { width: 2, height: 2, gray: Uint8ClampedArray.from([0, 64, 128, 255]), alpha: Uint8Array.from([255, 255, 255, 255]) } };
}

describe("ObliqueStackViewport display", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(createElement(ObliqueStackViewport, { state: { status: "hidden" }, onSelectSlice: vi.fn() }));
    expect(container.firstChild).toBeNull();
  });

  it("shows the slice indicator with its physical offset", () => {
    const { getByText } = render(createElement(ObliqueStackViewport, { state: ready(7, 15), onSelectSlice: vi.fn() }));
    expect(getByText("Slice 8 / 15 · +12.5 mm · S")).toBeTruthy(); // 1-based numbering, signed offset
  });

  it("shows 0.0 mm for the centre slice, without a sign", () => {
    const { getByText } = render(createElement(ObliqueStackViewport, { state: ready(7, 15, 0), onSelectSlice: vi.fn() }));
    expect(getByText("Slice 8 / 15 · 0.0 mm · S")).toBeTruthy();
  });

  it("normalizes a negative-zero offset to 0.0 mm", () => {
    const { getByText } = render(createElement(ObliqueStackViewport, { state: ready(7, 15, -0), onSelectSlice: vi.fn() }));
    expect(getByText("Slice 8 / 15 · 0.0 mm · S")).toBeTruthy();
  });

  it("keeps the minus sign for a negative offset, to one decimal", () => {
    const { getByText } = render(createElement(ObliqueStackViewport, { state: ready(0, 15, -17.5), onSelectSlice: vi.fn() }));
    expect(getByText("Slice 1 / 15 · -17.5 mm · S")).toBeTruthy();
  });

  it("shows the title and paints when ready", () => {
    putImageData.mockClear();
    const { getByText, container } = render(createElement(ObliqueStackViewport, { state: ready(), onSelectSlice: vi.fn() }));
    expect(getByText("Oblique Preview")).toBeTruthy();
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(putImageData).toHaveBeenCalled();
  });

  it("shows an unsupported message and no canvas or slider", () => {
    const { getByText, container } = render(createElement(ObliqueStackViewport, { state: { status: "unsupported", message: "unavailable" }, onSelectSlice: vi.fn() }));
    expect(getByText("unavailable")).toBeTruthy();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('input[type="range"]')).toBeNull();
  });

  it("shows the anatomical direction a positive offset advances along", () => {
    const { getByText } = render(createElement(ObliqueStackViewport, {
      state: ready(9, 15, 5, { code: "S-R", description: "Superior, then Right" }),
      onSelectSlice: vi.fn(),
    }));
    expect(getByText("Slice 10 / 15 · +5.0 mm · S-R")).toBeTruthy();
  });

  it("spells the direction out for the reader", () => {
    const { getByTitle } = render(createElement(ObliqueStackViewport, {
      state: ready(9, 15, 5, { code: "S-R", description: "Superior, then Right" }),
      onSelectSlice: vi.fn(),
    }));
    expect(getByTitle("Increasing offset moves Superior, then Right")).toBeTruthy();
  });

  it("omits the direction when the normal names none", () => {
    const { getByText } = render(createElement(ObliqueStackViewport, {
      state: ready(7, 15, 12.5, null),
      onSelectSlice: vi.fn(),
    }));
    expect(getByText("Slice 8 / 15 · +12.5 mm")).toBeTruthy();
  });

  it("is keyboard focusable with an accessible label when ready", () => {
    const { container } = render(createElement(ObliqueStackViewport, { state: ready(), onSelectSlice: vi.fn() }));
    const panel = container.querySelector('[aria-label="Oblique stack preview"]') as HTMLElement;
    expect(panel.getAttribute("tabindex")).toBe("0");
  });
});

describe("ObliqueStackViewport navigation", () => {
  it("slider selects a slice", () => {
    const onSelectSlice = vi.fn();
    const { container } = render(createElement(ObliqueStackViewport, { state: ready(7, 15), onSelectSlice }));
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "3" } });
    expect(onSelectSlice).toHaveBeenCalledWith(3);
  });

  it("arrow right/up advances, left/down retreats", () => {
    const onSelectSlice = vi.fn();
    const { container } = render(createElement(ObliqueStackViewport, { state: ready(7, 15), onSelectSlice }));
    const panel = container.querySelector('[aria-label="Oblique stack preview"]') as HTMLElement;
    fireEvent.keyDown(panel, { key: "ArrowRight" });
    expect(onSelectSlice).toHaveBeenLastCalledWith(8);
    fireEvent.keyDown(panel, { key: "ArrowUp" });
    expect(onSelectSlice).toHaveBeenLastCalledWith(8);
    fireEvent.keyDown(panel, { key: "ArrowLeft" });
    expect(onSelectSlice).toHaveBeenLastCalledWith(6);
    fireEvent.keyDown(panel, { key: "ArrowDown" });
    expect(onSelectSlice).toHaveBeenLastCalledWith(6);
  });

  it("wheel down advances, wheel up retreats, deterministically", () => {
    const onSelectSlice = vi.fn();
    const { container } = render(createElement(ObliqueStackViewport, { state: ready(7, 15), onSelectSlice }));
    const panel = container.querySelector('[aria-label="Oblique stack preview"]') as HTMLElement;
    const down = new WheelEvent("wheel", { deltaY: 10, cancelable: true });
    panel.dispatchEvent(down);
    expect(onSelectSlice).toHaveBeenLastCalledWith(8);
    expect(down.defaultPrevented).toBe(true);
    const up = new WheelEvent("wheel", { deltaY: -10, cancelable: true });
    panel.dispatchEvent(up);
    expect(onSelectSlice).toHaveBeenLastCalledWith(6);
  });

  it("does not navigate in a non-ready state", () => {
    const onSelectSlice = vi.fn();
    const { container } = render(createElement(ObliqueStackViewport, { state: { status: "waiting-for-volume" }, onSelectSlice }));
    const panel = container.querySelector('[aria-label="Oblique stack preview"]') as HTMLElement;
    fireEvent.keyDown(panel, { key: "ArrowRight" });
    panel.dispatchEvent(new WheelEvent("wheel", { deltaY: 10, cancelable: true }));
    expect(onSelectSlice).not.toHaveBeenCalled();
  });
});
