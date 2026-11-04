import { ID_LENGTH, isShareId, newShareId } from "./id";

describe("share ids", () => {
  it("are ten characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const id = newShareId();
      expect(id).toHaveLength(ID_LENGTH);
      expect(isShareId(id)).toBe(true);
      expect(id).not.toMatch(/[0OIl]/);
    }
  });

  it("skips bytes that would bias the draw", () => {
    // 255, 254 and 232 are at or past the largest multiple of 58 and are skipped; 231 is the last usable byte.
    const bytes = Uint8Array.from([255, 254, 0, 1, 57, 58, 232, 231, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(newShareId(() => bytes)).toBe("12z1z34567");
  });

  it("recognises what a share id looks like", () => {
    expect(isShareId("Ab3dEfGh9k")).toBe(true);
    expect(isShareId("short")).toBe(false);
    expect(isShareId("has/slash1")).toBe(false);
    expect(isShareId("0OIl0OIl0O")).toBe(false);
  });
});
