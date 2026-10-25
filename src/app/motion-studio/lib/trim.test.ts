import { revealDuration } from "@/app/components/motion-studio/engine/text";
import { makeChippy, makeLogo, makeRibbon, makeText } from "../presets";
import { canTrim, MIN_TRIM, trimClip } from "./trim";

describe("trimming on the timeline", () => {
  it("lengthens and shortens travel and draw times, never below the floor", () => {
    const chippy = makeChippy({ duration: 2 });
    expect(trimClip(chippy, 0.5).duration).toBe(2.5);
    expect(trimClip(chippy, -5).duration).toBe(MIN_TRIM);
    const ribbon = makeRibbon({ duration: 3 });
    expect(trimClip(ribbon, -1).duration).toBe(2);
  });

  it("spreads a letter-by-letter text's change over its letter gaps", () => {
    const text = makeText({ text: "Hello", reveal: "letters", direction: "left", letterStagger: 0.1, letterDuration: 0.4 });
    const before = revealDuration(text);
    const after = revealDuration(trimClip(text, 1));
    expect(after - before).toBeCloseTo(1, 5);
  });

  it("changes a popping text's reveal time directly", () => {
    const text = makeText({ reveal: "pop", revealDuration: 0.6 });
    expect(trimClip(text, 0.4).revealDuration).toBe(1);
  });

  it("leaves clips with a fixed length alone", () => {
    const logo = makeLogo();
    expect(canTrim(logo)).toBe(false);
    expect(trimClip(logo, 2)).toBe(logo);
  });
});
