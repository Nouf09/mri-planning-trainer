/** A single volume to load, expressed without reference to any imaging library. */
export interface VolumeSource {
  url: string;
  name?: string;
}

export type ImagingEngineStatus = "idle" | "loading" | "ready" | "error";
