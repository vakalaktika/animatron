// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { Clip, LogoClip } from "@/app/components/motion-studio/types";
import { KeyedNumField } from "./KeyedFields";

const logo: LogoClip = {
  id: "l",
  name: "Logo",
  enabled: true,
  start: 1,
  x: 100,
  y: 0,
  scale: 1,
  parentId: null,
  followRotation: false,
  type: "logo",
  size: 100,
  layerStagger: 0.1,
  layerDuration: 0.4,
  entryRotate: 0,
  entryScale: 0,
  overshoot: 0,
  traceDelay: 0,
  traceDuration: 0.5,
  fillDuration: 0.5,
};

function mount(clip: Clip, at: number) {
  const time = motionValue(at);
  const onChange = vi.fn();
  const view = render(<KeyedNumField clip={clip} prop="x" label="X" unit="px" min={0} max={1000} step={1} time={time} onChange={onChange} />);
  return { time, onChange, view };
}

describe("KeyedNumField", () => {
  test("the diamond keys the current value at the playhead", () => {
    const { onChange } = mount(logo, 2.5);
    fireEvent.click(screen.getByRole("button", { name: "Keyframe for X" }));
    expect(onChange.mock.calls[0][0].keys).toEqual({ x: [{ time: 1.5, value: 100, ease: { name: "inOut" } }] });
  });

  test("a keyed field follows the playhead and edits key there", () => {
    const keyed: Clip = { ...logo, keys: { x: [{ time: 0, value: 0, ease: { name: "linear" } }, { time: 2, value: 200 }] } };
    const { time, onChange } = mount(keyed, 2);
    const box = screen.getByRole("spinbutton", { name: "X in px" });
    expect(box).toHaveValue(100);
    act(() => time.set(3));
    expect(box).toHaveValue(200);
    expect(screen.getByRole("button", { name: "Keyframe for X at 3.00 s" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(box, { target: { value: "250" } });
    expect(onChange.mock.calls[0][0].keys.x[1]).toMatchObject({ time: 2, value: 250 });
  });

  test("an unkeyed field edits the clip's own value", () => {
    const { onChange } = mount(logo, 0);
    fireEvent.change(screen.getByRole("spinbutton", { name: "X in px" }), { target: { value: "42" } });
    expect(onChange.mock.calls[0][0]).toMatchObject({ x: 42 });
    expect(onChange.mock.calls[0][0].keys).toBeUndefined();
  });
});
