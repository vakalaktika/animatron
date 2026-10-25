import { revealDuration } from "@/app/components/motion-studio/engine/text";
import { audioSpan, clipDuration } from "@/app/components/motion-studio/engine/timing";
import { makeChippy, makeLogo, makeRibbon, makeText, makeVideoSprite, welcomePreset } from "../presets";
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

describe("video layers", () => {
  it("trims how long a video shows, never past the file's end", () => {
    const video = makeVideoSprite({ mediaId: "m1", label: "clip.mp4", aspect: 9 / 16, length: 8, trimStart: 2, playFor: 4 }, { width: 1920, height: 1080 }, true);
    expect(video.source.kind).toBe("video");
    const longer = trimClip(video, 10);
    expect(longer.source.kind === "video" && longer.source.playFor).toBe(6);
    const shorter = trimClip(video, -3.9);
    expect(shorter.source.kind === "video" && shorter.source.playFor).toBe(MIN_TRIM);
    expect(canTrim(video)).toBe(true);
  });

  it("keeps a backdrop on the clock for as long as it plays", () => {
    const video = makeVideoSprite({ mediaId: "m1", label: "clip.mp4", aspect: 9 / 16, length: 8, trimStart: 0, playFor: 5 }, { width: 1920, height: 1080 }, true);
    expect(clipDuration(video)).toBe(5);
    expect(video.path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(video.width).toBe(1920);
  });
});

describe("the sound's span", () => {
  it("runs from its offset to the end of the file or the composition", () => {
    const doc = { ...welcomePreset(), audio: { mediaId: "a", name: "song", length: 4, offset: 1, trimStart: 1, volume: 1, fadeOut: 0 } };
    expect(audioSpan(doc, 10)).toEqual({ start: 1, end: 4 });
    expect(audioSpan(doc, 2.5)).toEqual({ start: 1, end: 2.5 });
    expect(audioSpan({ ...doc, audio: { ...doc.audio, offset: 20 } }, 10)).toBeNull();
    expect(audioSpan({ ...doc, audio: null }, 10)).toBeNull();
  });
});
