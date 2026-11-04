import { isShareId } from "./id";

describe("share ids", () => {
  it("recognises the studio's ten URL-safe characters and nothing else", () => {
    expect(isShareId("Ab3dEfGh9k")).toBe(true);
    expect(isShareId("Ab3d-fG_9k")).toBe(true);
    expect(isShareId("short")).toBe(false);
    expect(isShareId("has/slash1")).toBe(false);
    expect(isShareId("../../etc/")).toBe(false);
  });
});
