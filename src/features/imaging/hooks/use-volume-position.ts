import { useCallback, useState } from "react";
import {
  arePositionsEqual,
  type VolumePosition,
} from "@/features/imaging/domain/volume-position";

/**
 * The single shared anatomical location for all viewports.
 *
 * Publishing an equal position keeps the previous object identity, so an echo
 * cannot start a render loop.
 */
export function useVolumePosition() {
  const [position, setPosition] = useState<VolumePosition | null>(null);

  const publishPosition = useCallback((next: VolumePosition) => {
    setPosition((previous) =>
      previous && arePositionsEqual(previous, next) ? previous : next
    );
  }, []);

  return { position, publishPosition };
}
