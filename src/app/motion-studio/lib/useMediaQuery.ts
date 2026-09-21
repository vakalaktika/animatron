import { useSyncExternalStore } from "react";

/**
 * Live result of a CSS media query. The studio is client-only (see page.tsx),
 * so the server snapshot is never shown; it defaults to false.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
