/**
 * A location inside the loaded volume, in world-space millimetres.
 *
 * Millimetres are the canonical unit because they are anatomically meaningful,
 * independent of any particular volume's voxel grid, and already the unit used
 * by the planning domain.
 */
export interface VolumePosition {
  x: number;
  y: number;
  z: number;
}

/** Sub-voxel tolerance used to decide whether two positions are the same point. */
export const POSITION_EPSILON_MM = 1e-3;

export function arePositionsEqual(
  a: VolumePosition,
  b: VolumePosition,
  epsilon: number = POSITION_EPSILON_MM
): boolean {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon
  );
}
