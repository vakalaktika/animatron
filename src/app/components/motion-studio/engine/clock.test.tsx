// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useStudioClock } from "./clock";

const preference = vi.hoisted(() => ({ reduced: true, tick: (_time: number, _delta: number) => {} }));
vi.mock("motion/react", async (original) => ({ ...await original<typeof import("motion/react")>(), useAnimationFrame: (tick: typeof preference.tick) => { preference.tick = tick; }, useReducedMotion: () => preference.reduced }));

it("respects reduced motion on autoplay and still allows explicit play", () => {
  preference.reduced = true;
  const { result } = renderHook(() => useStudioClock(8, { autoplay: true, loop: true }));
  expect(result.current.playing).toBe(false);
  act(() => result.current.play());
  expect(result.current.playing).toBe(true);
});

it("pauses when the system changes its reduced-motion preference", () => {
  preference.reduced = false;
  const { result, rerender } = renderHook(() => useStudioClock(8));
  expect(result.current.playing).toBe(true);
  preference.reduced = true;
  rerender();
  expect(result.current.playing).toBe(false);
});

it("stops exactly at the duration, clamps scrubbing, and replays after the end", () => {
  preference.reduced = false;
  const { result } = renderHook(() => useStudioClock(2, { speed: 2 }));
  act(() => preference.tick(0, 1500));
  expect(result.current.time.get()).toBe(2);
  expect(result.current.playing).toBe(false);
  act(() => result.current.play());
  expect(result.current.time.get()).toBe(0);
  act(() => result.current.seek(-1));
  expect(result.current.time.get()).toBe(0);
  act(() => result.current.seek(100));
  expect(result.current.time.get()).toBe(2);
  act(() => result.current.replay());
  expect(result.current.time.get()).toBe(0);
  act(() => result.current.toggle());
  expect(result.current.playing).toBe(false);
  act(() => preference.tick(0, 500));
  expect(result.current.time.get()).toBe(0);
  act(() => result.current.toggle());
  expect(result.current.playing).toBe(true);
  act(() => result.current.pause());
  expect(result.current.playing).toBe(false);
});

it("wraps elapsed time continuously on a loop, including a long frame", () => {
  preference.reduced = false;
  const { result } = renderHook(() => useStudioClock(2, { loop: true }));
  act(() => preference.tick(0, 4500));
  expect(result.current.time.get()).toBe(.5);
  expect(result.current.playing).toBe(true);
});
