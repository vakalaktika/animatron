// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { welcomePreset } from "../presets";
import { MiniPreview } from "./MiniPreview";

const clock = vi.hoisted(() => ({ seek: vi.fn(), replay: vi.fn(), pause: vi.fn(), time: {} }));
vi.mock("@/app/components/motion-studio/engine/clock", () => ({ useStudioClock: () => clock }));
vi.mock("@/app/components/motion-studio/StageCanvas", () => ({ StageCanvas: () => null }));
afterEach(() => vi.clearAllMocks());

it("parks hover previews when reduced motion is requested", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  render(<MiniPreview doc={welcomePreset()} active />);
  expect(clock.replay).not.toHaveBeenCalled();
  expect(clock.pause).toHaveBeenCalled();
  expect(clock.seek).toHaveBeenCalled();
});

it("plays hover previews when motion is allowed", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  render(<MiniPreview doc={welcomePreset()} active />);
  expect(clock.replay).toHaveBeenCalled();
});
