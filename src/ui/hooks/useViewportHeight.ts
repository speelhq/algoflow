import { useSyncExternalStore } from "react";

export function useViewportHeight(): number {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => window.innerHeight,
    () => 900,
  );
}
