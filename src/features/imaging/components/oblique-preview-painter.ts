import type { ObliquePreviewImage } from "@/features/imaging/reslice/runtime/oblique-preview.types";

/**
 * Paints a gray-scale preview onto a canvas.
 *
 * Presentation only: it expands gray + alpha into RGBA and blits. It does
 * no reslicing, no intensity mapping, no geometry, and never mutates its input
 * buffers. Smoothing is disabled for exact-pixel display; CSS scales the canvas.
 */
export function paintObliquePreview(
  canvas: HTMLCanvasElement,
  image: ObliquePreviewImage
): void {
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, image.width, image.height);

  const rgba = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0; i < image.width * image.height; i++) {
    const gray = image.gray[i];
    const base = i * 4;
    rgba[base] = gray;
    rgba[base + 1] = gray;
    rgba[base + 2] = gray;
    rgba[base + 3] = image.alpha[i];
  }

  ctx.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
}

/** Clears any previously painted anatomy, so no stale slice survives a state change. */
export function clearObliquePreview(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}
