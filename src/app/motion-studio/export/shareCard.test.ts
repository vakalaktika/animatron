import { cardPlacement, CARD_HEIGHT, CARD_WIDTH } from "./shareCard";

describe("cardPlacement", () => {
  it("fits a 16:9 frame to the card's height (the card is wider than that) and centres it", () => {
    const p = cardPlacement({ width: 1920, height: 1080 });
    expect(p.height).toBe(CARD_HEIGHT - 112);
    expect(p.width).toBe(Math.round(1920 * (518 / 1080)));
    expect(p.y).toBe(56);
    expect(Math.abs(p.x + p.width / 2 - CARD_WIDTH / 2)).toBeLessThanOrEqual(1);
  });

  it("fits a tall frame to the card's height", () => {
    const p = cardPlacement({ width: 1080, height: 1920 });
    expect(p.height).toBe(CARD_HEIGHT - 112);
    expect(p.width).toBe(Math.round(1080 * (518 / 1920)));
    expect(Math.abs(p.x + p.width / 2 - CARD_WIDTH / 2)).toBeLessThanOrEqual(1);
  });

  it("never scales a frame past the inset", () => {
    const p = cardPlacement({ width: 100, height: 100 });
    expect(p.width).toBe(CARD_HEIGHT - 112);
    expect(p.y).toBe(56);
  });
});
