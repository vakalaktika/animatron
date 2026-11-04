import { checkMeta, MAX_DESCRIPTION } from "./meta";

const meta = { name: "Strands to Logo", description: "Rainbow strands.", width: 1920, height: 1080, duration: 9.74, layers: 1, createdAt: "2026-11-04T00:00:00+00:00" };

describe("checkMeta", () => {
  it("passes what get_share_meta returns for a good share", () => {
    expect(checkMeta(meta)).toEqual(meta);
    expect(checkMeta({ ...meta, duration: null })).toEqual({ ...meta, duration: null });
  });

  it("trims, and cuts a description longer than a card holds", () => {
    expect(checkMeta({ ...meta, name: "  Strands  ", description: "x".repeat(MAX_DESCRIPTION + 50) })).toMatchObject({ name: "Strands", description: "x".repeat(MAX_DESCRIPTION) });
  });

  it.each([
    ["nothing", null],
    ["a blank name", { ...meta, name: " " }],
    ["a name that isn't text", { ...meta, name: 5 }],
    ["a width that isn't a number", { ...meta, width: "1920" }],
    ["a silly height", { ...meta, height: 1e9 }],
    ["a negative length", { ...meta, duration: -1 }],
    ["a description that isn't text", { ...meta, description: null }],
  ])("refuses %s", (_label, json) => {
    expect(checkMeta(json)).toBeNull();
  });
});
