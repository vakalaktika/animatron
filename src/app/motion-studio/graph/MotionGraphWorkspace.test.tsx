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
    {nodeTypes.motion({ ...node, selected: false })}
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
