import type { Point } from "../types";
import { bands, bbox } from "./geometry";

/**
 * Serialize one stroke to a standalone, self-contained SVG document string.
 * The viewBox is padded to fit the full width of the fanned bands so nothing
 * clips at the edges.
 */
export function svgString(
  pts: Point[],
  colors: string[],
  band: number,
): string {
  const [x, y, w, h] = bbox(pts, (colors.length * band) / 2 + 4);
  const paths = bands(pts, colors, band)
    .map(
      (b) =>
        `  <path d="${b.d}" fill="none" stroke="${b.color}" stroke-width="${b.w}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(1)} ${y.toFixed(
    1,
  )} ${w.toFixed(1)} ${h.toFixed(1)}" width="${w.toFixed(0)}" height="${h.toFixed(
    0,
  )}">\n${paths}\n</svg>\n`;
}

/**
 * Trigger a browser download of `text` as an SVG file named `name`. Creates a
 * throwaway blob URL, clicks a hidden anchor, and revokes the URL shortly
 * after so the blob doesn't leak.
 */
export function downloadSvg(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
