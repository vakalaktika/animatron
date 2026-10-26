// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { motionValue } from "motion/react";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import { docDuration } from "@/app/components/motion-studio/engine/timing";
import { TEMPLATES } from "./templates";

/**
 * Every template drawn by the real engine at the frame the gallery parks on
 * (two thirds of the way in): every clip is in the DOM and its text is
 * readable, so a tile never comes up blank.
 */
describe("template frames", () => {
  it.each(TEMPLATES.map((t) => [t.label, t] as const))("%s renders one frame headlessly with every layer present", (_label, t) => {
    const doc = t.make();
    const time = motionValue(docDuration(doc) * 0.66);
    const { container, unmount } = render(<StageCanvas doc={doc} time={time} />);
    const stage = container.firstElementChild as HTMLElement;
    expect(stage.style.width).toBe(`${doc.stage.width}px`);
    expect(stage.style.height).toBe(`${doc.stage.height}px`);
    for (const clip of doc.clips) {
      if (clip.type === "text") expect(container.textContent).toContain(clip.text);
    }
    const sprites = doc.clips.filter((c) => c.type === "sprite" && c.source.kind !== "chippy").length;
    const ribbons = doc.clips.filter((c) => c.type === "ribbon").length;
    expect(container.querySelectorAll("img").length).toBe(sprites);
    expect(container.querySelectorAll("[data-ribbon-for]").length).toBe(ribbons);
    unmount();
  });
});
