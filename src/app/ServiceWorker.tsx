"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (public/sw.js) in production builds.
 * In development it would cache files that are meant to change on every
 * save, so it stays off there.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch((err: unknown) => {
      // Offline support is an extra: the studio works without it, so say why and carry on.
      console.warn("Animatron could not set up offline use:", err);
    });
  }, []);
  return null;
}
