// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import { makeText } from "../presets";
import { ObjectTween } from "./ObjectTween";

test("human creates an editable tween without entering intermediate frames", () => {
  const onChange = vi.fn();
  render(<ObjectTween clip={makeText({ id: "title", start: 0, x: 100, y: 200 })} time={motionValue(0)} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Tween to…" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Destination X in px" }), { target: { value: "600" } });
  fireEvent.click(screen.getByRole("button", { name: "Create tween" }));
  const next = onChange.mock.calls[0][0];
  expect(next.keys.x).toEqual([{ time: 0, value: 100, ease: { name: "inOut" } }, { time: 1, value: 600, ease: { name: "inOut" } }]);
  expect(Object.keys(next.keys)).toEqual(["x"]);
  expect(screen.getByRole("status")).toHaveTextContent("Tween added");
});
