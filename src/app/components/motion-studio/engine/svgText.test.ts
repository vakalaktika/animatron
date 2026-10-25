import { parseSvg, RUN_ATTR, svgDataUrl } from "./svgText";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <defs><text id="hidden">template</text></defs>
  <symbol id="s"><text>symbol text</text></symbol>
  <mask id="m"><text>mask text</text></mask>
  <text x="10" y="40">Hello</text>
  <text x="10" y="80"><tspan>World</tspan></text>
  <text x="0" y="0">   </text>
</svg>`;

describe("parseSvg", () => {
  test("finds live text and skips defs, symbols, masks, and empty runs", () => {
    const parsed = parseSvg(SVG);
    expect(parsed?.textRuns.map((r) => r.text)).toEqual(["Hello", "World"]);
    expect(parsed?.aspect).toBeCloseTo(0.5);
    expect(parsed?.markup.match(new RegExp(RUN_ATTR, "g"))).toHaveLength(2);
  });

  test("returns null for something that is not SVG", () => {
    expect(parseSvg("<html><body>nope</body></html>")).toBeNull();
    expect(parseSvg("not xml at all <<<")).toBeNull();
  });

  test("falls back to width and height when there is no viewBox", () => {
    expect(parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"></svg>')?.aspect).toBeCloseTo(0.5);
  });
});

describe("svgDataUrl", () => {
  test("applies edited text and hides detached runs", () => {
    const parsed = parseSvg(SVG);
    if (!parsed) throw new Error("parse failed");
    const runs = parsed.textRuns.map((r, i) => (i === 0 ? { ...r, text: "Hi there" } : { ...r, detachedTo: "clip-1" }));
    const url = svgDataUrl({ kind: "svg", markup: parsed.markup, label: "a.svg", aspect: parsed.aspect, textRuns: runs });
    const markup = decodeURIComponent(url.replace("data:image/svg+xml;charset=utf-8,", ""));
    expect(markup).toContain(">Hi there<");
    expect(markup).not.toContain("Hello");
    expect(markup).toMatch(/data-studio-run="run-4"[^>]*display="none"/);
  });
});
