import type { MetadataRoute } from "next";

// Generated at build time into the static export. Paths carry the Pages
// subpath (NEXT_PUBLIC_BASE_PATH) so the installed app opens the studio.
export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "Animatron",
    short_name: "Animatron",
    description: "Make short animations in the browser: text, ribbons, pictures and characters on one timeline.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#fbf7f0",
    theme_color: "#186a63",
    categories: ["design", "graphics", "productivity"],
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `${base}/icons/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
