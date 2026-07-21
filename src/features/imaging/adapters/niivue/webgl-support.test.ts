import { describe, it, expect, vi, afterEach } from "vitest";
import { hasWebGL2 } from "@/features/imaging/adapters/niivue/webgl-support";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hasWebGL2", () => {
  it("is true when a webgl2 context can be created", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as unknown as RenderingContext
    );
    expect(hasWebGL2()).toBe(true);
  });

  it("is false when the context is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(hasWebGL2()).toBe(false);
  });

  it("is false when creating the context throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("context creation blocked");
    });
    expect(hasWebGL2()).toBe(false);
  });

  it("requests the webgl2 context specifically", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as unknown as RenderingContext);
    hasWebGL2();
    expect(getContext).toHaveBeenCalledWith("webgl2");
  });
});
