// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { makeText } from "../presets";
import { MotionFields } from "./MotionFields";
import { addMotionController, addMotionPath, keyMotionController } from "../lib/motionEdit";

afterEach(cleanup);
const doc = (clip: ReturnType<typeof makeText>): StudioDoc => ({ version: 4, name: "Test", stage: { width: 1280, height: 720, background: "#fff", transparent: false }, clips: [clip] });

test("human adds object motion and keeps the artwork", () => {
  const clip = makeText({ id: "title", text: "Unchanged" });
  const onChange = vi.fn();
  render(<MotionFields doc={doc(clip)} clip={clip} time={motionValue(0)} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Add motion path" }));
  expect(onChange.mock.calls[0][0].text).toBe("Unchanged");
  expect(onChange.mock.calls[0][0].motion.blocks[0].type).toBe("path");
});

test("human retimes a hand target without creating more keys",()=>{
 const base=addMotionController(makeText({id:"title",start:0}),{x:10,y:20},"Hand");
 const clip=keyMotionController(base,base.motion!.controllers![0].id,2,{x:30,y:40}),onChange=vi.fn();
 render(<MotionFields doc={doc(clip)} clip={clip} time={motionValue(0)} onChange={onChange}/>);
 fireEvent.change(screen.getByRole("spinbutton",{name:"Hand key 2.00 time in s"}),{target:{value:"3"}});
 expect(onChange.mock.calls.at(-1)![0].motion.controllers[0].keys.x.map((k:{time:number})=>k.time)).toEqual([0,3]);
});

test("human retimes sparse blocks and disables them", () => {
  const clip = addMotionPath(makeText({ id: "title", start: 0 }), 0);
  const onChange = vi.fn();
  render(<MotionFields doc={doc(clip)} clip={clip} time={motionValue(0)} onChange={onChange} />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Move along path duration in s" }), { target: { value: "3" } });
  expect(onChange.mock.calls[0][0].motion.blocks[0].duration).toBe(3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Move along path enabled" }));
  expect(onChange.mock.calls.at(-1)![0].motion.blocks[0].enabled).toBe(false);
});

test("keyboard-accessible target fields write sparse keys at playhead", () => {
  const clip = addMotionController(makeText({ id: "title", start: 0 }), { x: 10, y: 20 }, "Hand");
  const onChange = vi.fn();
  render(<MotionFields doc={doc(clip)} clip={clip} time={motionValue(1)} onChange={onChange} />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Hand X in px" }), { target: { value: "60" } });
  expect(onChange.mock.calls[0][0].motion.controllers[0].keys.x).toHaveLength(2);
  expect(onChange.mock.calls[0][0].motion.controllers[0].keys.x[1].value).toBe(60);
});

test("optional relationship view uses the same editable controls", async () => {
  const clip = addMotionController(makeText({ id: "title", start: 0 }), { x: 10, y: 20 }, "Hand");
  const onChange = vi.fn();
  render(<MotionFields doc={doc(clip)} clip={clip} time={motionValue(0)} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Relationships (advanced)" }));
  await waitFor(() => expect(screen.getByRole("group", { name: "Motion relationships" })).toBeVisible());
  expect(screen.getByText("Hand → target")).toBeVisible();
});

test("relationship nodes edit the canonical constraint without a second graph state",async()=>{
 const target=makeText({id:"carrier",start:0});
 const clip={...makeText({id:"held",start:0}),motion:{constraints:[{id:"grip",name:"Grip",type:"attach" as const,targetClipId:"carrier",offset:{x:0,y:0,rotation:0}}]}};
 const onChange=vi.fn();render(<MotionFields doc={{...doc(clip),clips:[target,clip]}} clip={clip} time={motionValue(0)} onChange={onChange}/>);
 fireEvent.click(screen.getByRole("button",{name:"Relationships (advanced)"}));
 fireEvent.click(await screen.findByRole("button",{name:"Disable Grip relationship"}));
 expect(onChange.mock.calls.at(-1)![0].motion.constraints[0].enabled).toBe(false);
 expect(onChange.mock.calls.at(-1)![0]).not.toHaveProperty("graph");
});
