/**
 * Reports whether the current environment can provide a WebGL2 context.
 *
 * Used to keep engine selection deterministic: without WebGL2 the factory
 * returns the legacy JPG engine instead of a volume engine that cannot render.
 */
export function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}
