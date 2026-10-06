// U-03: the panel's upper bound follows the viewport width, so a resized window redraws it.
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, () => window.innerWidth);
}
