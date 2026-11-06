// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { makeText } from "../presets";
import { addMotionController, addMotionPath } from "../lib/motionEdit";
import { MotionGraphWorkspace } from "./MotionGraphWorkspace";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, nodeTypes, children, onNodeClick, onNodeDragStop }: any) => <div aria-label="Node canvas">{nodes.map((node: any) => <div key={node.id}>
    <button onClick={() => onNodeClick({}, node)}>Select {node.data.node.label}</button>
    <button onClick={() => onNodeDragStop({}, { ...node, position: { x: 123, y: 234 } }, [{ ...node, position: { x: 123, y: 234 } }])}>Move {node.data.node.label}</button>
    {(() => { const Card = nodeTypes.motion; return <Card {...node} selected={false} />; })()}
  </div>)}{children}</div>,
  Background: () => null, Controls: () => null, MiniMap: () => null,
  Handle: ({ children }: any) => <span>{children}</span>, Position: { Left: "left", Right: "right" },
  applyNodeChanges: (_: unknown, nodes: unknown) => nodes,
}));

afterEach(cleanup);
const initial = (): StudioDoc => ({ version: 4, name: "Graph", stage: { width: 1280, height: 720, background: "#fff", transparent: false }, clips: [addMotionPath(addMotionController(makeText({ id: "title", name: "Title", start: 0 }), { x: 10, y: 20 }, "Hand"), 0)] });
function mount(doc = initial()) {
  const onChange = vi.fn(), onSelectClip = vi.fn(), onClose = vi.fn(), time = motionValue(0);
  render(<MotionGraphWorkspace doc={doc} time={time} selectedClipId="title" onChange={onChange} onSelectClip={onSelectClip} onClose={onClose} />);
  return { onChange, onSelectClip, onClose, time };
}

test("adds an editable path while retaining existing artwork", () => {
  const { onChange } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Add path" }));
  const next = onChange.mock.calls.at(-1)![0];
  expect(next.clips[0].motion.blocks).toHaveLength(2);
  expect(next.clips[0].text).toBe(initial().clips[0].type === "text" ? (initial().clips[0] as any).text : "");
});

test("connects a motion block to a target using accessible port buttons", () => {
  const { onChange } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Move along path: Moves" }));
  fireEvent.click(screen.getByRole("button", { name: "Hand: Motion" }));
  expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks[0].controllerId).toBe("target-1");
});

test("Escape cancels an incomplete connection without changing the document", () => {
  const { onChange } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Move along path: Moves" }));
  fireEvent.keyDown(screen.getByRole("region", { name: "Motion node editor" }), { key: "Escape" });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Connection cancelled");
});

test("moving a card stores layout without changing artwork or motion", () => {
  const doc = initial(), { onChange } = mount(doc);
  fireEvent.click(screen.getByRole("button", { name: "Move Hand" }));
  const next = onChange.mock.calls.at(-1)![0];
  expect(Object.values(next.editor.motionGraph.positions)).toContainEqual({ x: 123, y: 234 });
  expect(next.clips).toBe(doc.clips);
});

test("selecting a motion node synchronizes object selection and timing editing", () => {
  const { onChange, onSelectClip } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Select Move along path" }));
  expect(onSelectClip).toHaveBeenCalledWith("title");
  fireEvent.change(screen.getByRole("spinbutton", { name: "Node duration" }), { target: { value: "3" } });
  expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks[0].duration).toBe(3);
});

test("search and scope do not alter the composition", () => {
  const { onChange } = mount();
  fireEvent.change(screen.getByRole("searchbox", { name: "Find nodes" }), { target: { value: "Hand" } });
  expect(screen.getByRole("button", { name: "Select Hand" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Select Move along path" })).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test("incompatible ports explain the error without altering the saved graph",()=>{
 const {onChange}=mount();fireEvent.click(screen.getByRole("button",{name:"Move along path: Moves"}));fireEvent.click(screen.getByRole("button",{name:"Hand: Target"}));
 expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole("status")).toHaveTextContent(/output and an input/);
 fireEvent.click(screen.getByRole("button",{name:"Move along path: Moves"}));expect(screen.getByRole("status")).toHaveTextContent(/cancelled/);
});

test("node duplication and suspension keep sparse programs editable",()=>{
 const {onChange}=mount();fireEvent.click(screen.getByRole("button",{name:"Select Move along path"}));
 fireEvent.click(screen.getByRole("button",{name:"Duplicate nodes"}));expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks).toHaveLength(2);
 fireEvent.click(screen.getByRole("button",{name:"Enable / disable"}));expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks[0].enabled).toBe(false);
 fireEvent.keyDown(screen.getByRole("region",{name:"Motion node editor"}),{key:"d",ctrlKey:true});expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks).toHaveLength(2);
 fireEvent.click(screen.getByRole("button",{name:"Remove nodes"}));expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks).toHaveLength(0);
});

test("keyboard deletion and unsupported target suspension give clear outcomes",()=>{
 const {onChange}=mount();fireEvent.click(screen.getByRole("button",{name:"Select Hand"}));
 fireEvent.click(screen.getByRole("button",{name:"Enable / disable"}));expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole("status")).toHaveTextContent(/Targets cannot/);
 fireEvent.keyDown(screen.getByRole("region",{name:"Motion node editor"}),{key:"Delete"});expect(onChange.mock.calls.at(-1)![0].clips[0].motion.controllers).toHaveLength(0);
});

test("workspace undo shortcuts remain scoped to graph edits",()=>{
 const onUndo=vi.fn(),onRedo=vi.fn();render(<MotionGraphWorkspace doc={initial()} time={motionValue(0)} selectedClipId="title" onChange={vi.fn()} onSelectClip={vi.fn()} onClose={vi.fn()} onUndo={onUndo} onRedo={onRedo}/>);
 fireEvent.click(screen.getByRole("button",{name:"Undo"}));fireEvent.click(screen.getByRole("button",{name:"Redo"}));
 fireEvent.keyDown(screen.getByRole("region",{name:"Motion node editor"}),{key:"z",ctrlKey:true});fireEvent.keyDown(screen.getByRole("region",{name:"Motion node editor"}),{key:"z",ctrlKey:true,shiftKey:true});expect(onUndo).toHaveBeenCalledTimes(2);expect(onRedo).toHaveBeenCalledTimes(2);
});

test("whole-scene scope exposes other layers and an empty search has guidance",()=>{
 const doc=initial();doc.clips.push(makeText({id:"second",name:"Second"}));const {onSelectClip,onClose}=mount(doc);
 fireEvent.change(screen.getByRole("combobox",{name:"Graph scope"}),{target:{value:"all"}});fireEvent.click(screen.getByRole("button",{name:"Select Second"}));expect(onSelectClip).toHaveBeenCalledWith("second");
 fireEvent.change(screen.getByRole("searchbox",{name:"Find nodes"}),{target:{value:"nonexistent"}});expect(screen.getByText(/No matching nodes/)).toBeVisible();fireEvent.click(screen.getByRole("button",{name:"Expand"}));fireEvent.click(screen.getByRole("button",{name:"Compact"}));fireEvent.click(screen.getByRole("button",{name:"Close nodes"}));expect(onClose).toHaveBeenCalled();
});


test("node details are on demand and can be dismissed without changing the graph", () => {
  const { onChange } = mount();
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(screen.queryByText("Active at playhead")).toBeNull();
  const details = screen.getByRole("button", { name: "About Hand" });
  fireEvent.mouseEnter(details);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Title");
  expect(screen.getByRole("tooltip")).toHaveTextContent("Active at playhead");
  expect(fireEvent.keyDown(document, { key: "Escape", cancelable: true })).toBe(false);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.focus(details);
  expect(screen.getByRole("tooltip")).toBeVisible();
  fireEvent.blur(details);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.click(details);
  expect(screen.getByRole("tooltip")).toBeVisible();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test("the inspector uses canvas space only after selecting a node", () => {
  mount();
  expect(screen.queryByText(/Select a node to edit it/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select Hand" }));
  expect(screen.getByRole("complementary", { name: "Node inspector" })).toBeVisible();
});
