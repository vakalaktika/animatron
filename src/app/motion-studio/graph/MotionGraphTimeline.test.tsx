// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { makeText } from "../presets";
import { MotionGraphTimeline } from "./MotionGraphTimeline";

afterEach(cleanup);
beforeAll(() => { window.PointerEvent = MouseEvent as typeof PointerEvent; });
const scene = (): StudioDoc => ({ version: 4, name: "Timing", timeline: { duration: 5, tailSeconds: 0 }, stage: { width: 800, height: 600, background: "#fff", transparent: false }, clips: [{ ...makeText({ id: "actor", start: 1 }), motion: {
 blocks: [{ id: "lift", name: "Lift", type: "transform", start: 0, duration: 1, repeat: 2, alternate: true, from: {}, to: { y: -10 } }],
 controllers: [{ id: "hand", name: "Hand", space: "stage", x: 10, y: 20, keys: { x: [{ time: 0, value: 10 }, { time: 2, value: 20 }], y: [{ time: 0, value: 20 }, { time: 2, value: 30 }] } }],
 constraints: [],
} }] });
const view = (doc = scene()) => { const onChange = vi.fn(), time = motionValue(0), onSelectNode = vi.fn(); render(<MotionGraphTimeline doc={doc} clipId="actor" time={time} onChange={onChange} onSelectNode={onSelectNode} />); return { onChange, time, onSelectNode }; };

test("numeric timing extends duration for repeated motion without changing artwork", () => {
 const source = scene(), { onChange } = view(source);
 fireEvent.change(screen.getByRole("spinbutton", { name: "Lift cycle duration" }), { target: { value: "3" } });
 const next = onChange.mock.calls[0][0];
 expect(next.clips[0].motion.blocks[0].duration).toBe(3);
 expect(next.timeline.duration).toBe(7);
 expect(next.clips[0].text).toBe((source.clips[0] as { text?: string }).text);
 expect(screen.getByText(/2 cycles/)).toBeVisible();
});
test("all target axes move together and collisions preserve previous keys", () => {
 const { onChange } = view();
 fireEvent.change(screen.getByRole("spinbutton", { name: "Hand key 2 time" }), { target: { value: "3" } });
 expect(onChange.mock.calls[0][0].clips[0].motion.controllers[0].keys.y[1].time).toBe(3);
 fireEvent.change(screen.getByRole("spinbutton", { name: "Hand key 2 time" }), { target: { value: "0" } });
 expect(onChange).toHaveBeenCalledTimes(1);
 expect(screen.getByRole("status")).toHaveTextContent(/collision/i);
});
test("a long timing drag commits only once on release", () => {
 const { onChange } = view(); const bar = screen.getByRole("button", { name: "Move Lift timing" });
 fireEvent.pointerDown(bar, { clientX: 100, button: 0 });
 fireEvent.pointerMove(bar, { clientX: 130 }); fireEvent.pointerMove(bar, { clientX: 160 });
 expect(onChange).not.toHaveBeenCalled();
 fireEvent.pointerUp(bar, { clientX: 160 });
 expect(onChange).toHaveBeenCalledTimes(1);
 expect(onChange.mock.calls[0][0].clips[0].motion.blocks[0].start).toBeGreaterThan(0);
});
test("Escape cancels an in-progress timing drag", () => {
 const { onChange } = view(); const bar = screen.getByRole("button", { name: "Move Lift timing" });
 fireEvent.pointerDown(bar, { clientX: 100, button: 0 }); fireEvent.pointerMove(bar, { clientX: 150 });
 fireEvent.keyDown(bar, { key: "Escape" }); fireEvent.pointerUp(bar, { clientX: 150 });
 expect(onChange).not.toHaveBeenCalled();
});
test("keyboard timing nudge selects the matching node and changes a sparse block", () => {
 const { onChange, onSelectNode } = view();
 fireEvent.keyDown(screen.getByRole("button", { name: "Move Lift timing" }), { key: "ArrowRight" });
 expect(onChange.mock.calls[0][0].clips[0].motion.blocks[0].start).toBeCloseTo(.1);
 expect(onSelectNode).toHaveBeenCalledWith(encodeURIComponent(JSON.stringify(["actor", "block", "lift"])));
});
test("playhead seeks composition time and no clip has a useful empty state", () => {
 const { time } = view(); fireEvent.change(screen.getByRole("slider", { name: "Motion playhead" }), { target: { value: "3" } });
 expect(time.get()).toBe(3);
 cleanup(); render(<MotionGraphTimeline doc={scene()} clipId={null} time={time} onChange={vi.fn()} />);
 expect(screen.getByText(/Select an object/)).toBeVisible();
});
