import { useMemo, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const media = useMemo(() => window.matchMedia(query), [query]);
  return useSyncExternalStore(
    (onChange) => {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => media.matches,
    () => true,
  );
}
