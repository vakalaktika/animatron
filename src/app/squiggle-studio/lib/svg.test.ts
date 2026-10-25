import type { Point } from "../types";
import { svgString } from "./svg";

const PTS: Point[] = [
  [0, 0],
  [10, 10],
  [20, 0],
];
const COLORS = ["#c74028", "#59996a", "#457a9d"];

describe("svgString", () => {
  it("produces a standalone svg with one path per color", () => {
    const out = svgString(PTS, COLORS, 8);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain("viewBox=");
    expect(out).toMatch(/width="\d+"/);
    expect(out).toMatch(/height="\d+"/);
    expect(out.match(/<path/g)).toHaveLength(COLORS.length);
  });

  it("embeds each concrete color so the file renders on its own", () => {
    const out = svgString(PTS, COLORS, 8);
    for (const c of COLORS) expect(out).toContain(`stroke="${c}"`);
    expect(out).not.toContain("var(--");
  });
});
