// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RigClip } from "@/app/components/motion-studio/types";
import { rigAnimationSection, type RigActions } from "./rig";

function mount() {
  const clip: RigClip = {
    id:"ink", type:"rig", name:"Ink", enabled:true, start:1, x:0, y:0, scale:1,
    parentId:null, followRotation:false, pose:{}, animationId:"nod",
    rig:JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../docs/mci-rig/example-character.mci.json"),"utf8")),
  };
  const onChange = vi.fn();
  const rig: RigActions = { mode:"pose", onMode:vi.fn(), selectedBone:"head", onSelectBone:vi.fn(), time:motionValue(1), onSeek:vi.fn(), onSaveRig:vi.fn() };
  render(rigAnimationSection(clip, onChange, rig).content);
  return {clip,onChange,rig};
}

it("captures only the selected bone instead of every bone", () => {
  const {onChange} = mount();
  fireEvent.click(screen.getByRole("button", {name:/Key selected bone/}));
  expect(onChange.mock.calls[0][0].rig.animations.find((a:{id:string})=>a.id==="nod").tracks).toHaveLength(1);
});

it("lets a human change the timing curve without adding dense keys", () => {
  const {onChange} = mount();
  fireEvent.change(screen.getByRole("combobox", {name:"Tween at 0.00 s"}), {target:{value:"inOut"}});
  const next = onChange.mock.calls[0][0];
  expect(next.rig.version).toBe(3);
  expect(next.rig.animations[1].tracks[0].keys).toHaveLength(6);
  expect(next.rig.animations[1].tracks[0].keys[0].tween).toEqual({name:"inOut"});
});

it("exposes exact pose values and times for direct editing", () => {
  const {onChange} = mount();
  fireEvent.change(screen.getByRole("spinbutton", {name:"Turn at 0.00 s in °"}), {target:{value:"8"}});
  expect(onChange.mock.calls[0][0].rig.animations[1].tracks[0].keys[0].rotation).toBe(8);
  expect(screen.getByRole("spinbutton", {name:"Time of key 0.00 s in s"})).toBeInTheDocument();
});
