// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RigAsset } from "../types";
import { parseRigSvg } from "./rigSvg";

const fixture = (): RigAsset => JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../docs/mci-rig/example-character.mci.json"), "utf8")) as RigAsset;

const wrap = (body: string, canvas = { width: 100, height: 100 }, bindings: RigAsset["bindings"] = []) => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}">${body}</svg>`,
  canvas,
  bindings,
});

const bindA: RigAsset["bindings"] = [{ id: "b", svgId: "a", boneId: "root", bindMatrix: [1, 0, 0, 1, 0, 0] }];

describe("parseRigSvg", () => {
  it("accepts the fixture and finds every bound group as a direct child", () => {
    const asset = fixture();
    const result = parseRigSvg(asset);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.svg.groups.keys()]).toEqual(asset.bindings.map((b) => b.svgId).sort((a, b) => [...result.svg.groups.keys()].indexOf(a) - [...result.svg.groups.keys()].indexOf(b)));
    expect(result.svg.root.children[0].tag).toBe("title");
    expect(result.svg.elements).toBeGreaterThan(asset.bindings.length);
  });

  it("accepts the solid paints the contract allows", () => {
    for (const paint of ["#bd4b35", "#fff", "none", "currentColor", "rgb(1, 2, 3)", "rgba(1,2,3,0.5)", "hsl(10 50% 50%)", "teal"]) {
      expect(parseRigSvg(wrap(`<g id="a"><rect width="1" height="1" fill="${paint}" stroke="${paint}"/></g>`, undefined, bindA)).ok).toBe(true);
    }
  });

  it("turns presentation attributes into React prop names", () => {
    const result = parseRigSvg(wrap('<g id="a"><path d="M0 0" stroke-width="2" fill-rule="evenodd" fill="none"/></g>', undefined, bindA));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svg.groups.get("a")!.children[0].attrs).toEqual({ d: "M0 0", strokeWidth: "2", fillRule: "evenodd", fill: "none" });
  });

  it.each([
    ["a script", '<script>alert(1)</script>', /<script>/],
    ["an event handler", '<g id="a" onclick="x()"><path d="M0 0"/></g>', /event attribute/],
    ["live text", '<text x="0" y="0">hi</text>', /<text>/],
    ["an image", '<image href="x.png"/>', /<image>/],
    ["a use reference", '<use href="#a"/>', /<use>/],
    ["a style block", '<style>g{fill:red}</style>', /<style>/],
    ["a style attribute", '<g id="a" style="fill:red"><path d="M0 0"/></g>', /style attributes/],
    ["a gradient paint", '<defs><linearGradient id="g"/></defs>', /<defs>/],
    ["a paint server reference", '<g id="a"><rect width="1" height="1" fill="url(#g)"/></g>', /only solid colours/],
    ["an escaped paint reference", '<g id="a"><rect width="1" height="1" fill="u\\72l(#g)"/></g>', /only solid colours/],
    ["a filter", '<g id="a" filter="url(#f)"><path d="M0 0"/></g>', /attribute the rig format does not allow: filter/],
    ["a mask", '<mask id="m"/>', /<mask>/],
    ["foreignObject", '<foreignObject><div/></foreignObject>', /<foreignObject>/],
    ["a non-SVG element", '<div xmlns="http://www.w3.org/1999/xhtml"/>', /non-SVG/],
  ])("rejects %s with a reason", (_what, body, pattern) => {
    const result = parseRigSvg(wrap(body));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  });

  it("rejects a declared xlink reference", () => {
    const result = parseRigSvg({ svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><g id="a" xlink:href="#x"><path d="M0 0"/></g></svg>', canvas: { width: 100, height: 100 }, bindings: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/does not allow/);
  });

  it("rejects markup that does not parse, a root that is not svg, and a viewBox that disagrees with the canvas", () => {
    expect(parseRigSvg({ svg: "<svg", canvas: { width: 1, height: 1 }, bindings: [] }).ok).toBe(false);
    expect(parseRigSvg({ svg: '<g xmlns="http://www.w3.org/2000/svg"/>', canvas: { width: 1, height: 1 }, bindings: [] }).ok).toBe(false);
    const off = parseRigSvg({ ...wrap(""), canvas: { width: 200, height: 100 } });
    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.error).toMatch(/viewBox must be "0 0 200 100"/);
  });

  it("rejects a drawable group that no binding claims", () => {
    const loose = parseRigSvg(wrap('<g id="a"><path d="M0 0"/></g><g id="b"><path d="M0 0"/></g>', undefined, bindA));
    expect(loose.ok).toBe(false);
    if (!loose.ok) expect(loose.error).toMatch(/"b" is not bound/);
  });

  it("rejects a binding whose group is nested or missing, and duplicate group ids", () => {
    const nested = parseRigSvg(wrap('<g id="outer"><g id="inner"><path d="M0 0"/></g></g>', undefined, [{ id: "b", svgId: "inner", boneId: "root", bindMatrix: [1, 0, 0, 1, 0, 0] }]));
    expect(nested.ok).toBe(false);
    if (!nested.ok) expect(nested.error).toMatch(/not a direct child/);
    const dup = parseRigSvg(wrap('<g id="a"/><g id="a"/>'));
    expect(dup.ok).toBe(false);
  });

  it("refuses more than 3000 elements", () => {
    const many = Array.from({ length: 3001 }, () => '<rect width="1" height="1"/>').join("");
    const result = parseRigSvg(wrap(`<g id="a">${many}</g>`));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/more than 3000/);
  });
});
