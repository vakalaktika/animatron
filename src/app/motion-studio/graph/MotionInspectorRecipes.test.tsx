// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { RigClip, StudioDoc } from "@/app/components/motion-studio/types";
import { makeText } from "../presets";
import { buildMotionGraph } from "../lib/motionGraph";
import { MotionNodeInspector, nodeActive } from "./MotionNodeInspector";
import { MotionRecipePalette } from "./MotionRecipePalette";

afterEach(cleanup);
const actor = (): RigClip => ({...makeText({id:"actor",name:"Actor",start:0}),type:"rig",animationId:null,pose:{},rig:{format:"mid-century-ink-rig",version:4,canvas:{width:200,height:200},svg:'<svg viewBox="0 0 200 200"><g id="art"/></svg>',bindings:[],animations:[],bones:[{id:"upper",parentId:null,rest:{x:100,y:100,rotation:0},length:50},{id:"fore",parentId:"upper",rest:{x:50,y:0,rotation:0},length:50},{id:"hand",parentId:"fore",rest:{x:50,y:0,rotation:0},length:0}],slots:[{id:"grip",boneId:"hand",x:0,y:0,rotation:0}]},motion:{controllers:[{id:"goal",name:"Hand",space:"stage",x:130,y:140}],blocks:[{id:"breath",name:"Breathing",type:"oscillate",start:0,duration:4,property:"y",amplitude:2}],constraints:[{id:"reach",name:"Reach",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"goal",bend:1,start:0,end:3}]}});
const scene = (): StudioDoc => ({version:4,name:"Inspector",stage:{width:800,height:600,background:"#fff",transparent:false},clips:[actor(),makeText({id:"prop",start:0})]});
function inspector(kind: string,itemId?:string) {
 const doc=scene(),node=buildMotionGraph(doc).nodes.find(n=>n.clipId==="actor"&&n.kind===kind&&(!itemId||n.itemId===itemId)),onChange=vi.fn(),onError=vi.fn();
 render(<MotionNodeInspector doc={doc} node={node} time={1} onChange={onChange} onError={onError}/>);
 return {doc,node:node!,onChange,onError};
}
test("inspector edits named target and sparse pose without changing source rig",()=>{
 const {doc,onChange}=inspector("controller");
 fireEvent.change(screen.getByRole("textbox",{name:"Node name"}),{target:{value:"Plane hand"}});
 expect(onChange.mock.calls.at(-1)![0].clips[0].motion.controllers[0].name).toBe("Plane hand");
 fireEvent.change(screen.getByRole("spinbutton",{name:"Target X"}),{target:{value:"160"}});
 const next=onChange.mock.calls.at(-1)![0];expect(next.clips[0].motion.controllers[0].keys.x.at(-1)).toMatchObject({time:1,value:160});expect(next.clips[0].rig).toBe((doc.clips[0] as RigClip).rig);
});
test("inspector edits oscillation, repeats, and alternation",()=>{
 const {onChange}=inspector("block");
 for(const [name,value,property] of [["Node start","1","start"],["Node repeats","3","repeat"],["Motion amount","5","amplitude"]]) {fireEvent.change(screen.getByRole("spinbutton",{name}),{target:{value}});expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks[0][property]).toBe(Number(value));}
 fireEvent.click(screen.getByRole("checkbox",{name:"Alternate direction"}));expect(onChange.mock.calls.at(-1)![0].clips[0].motion.blocks[0].alternate).toBe(true);
});
test("inspector validates reach intervals and edits weight and bend",()=>{
 const {onChange,onError}=inspector("constraint");
 fireEvent.change(screen.getByRole("spinbutton",{name:"Relationship start"}),{target:{value:"5"}});expect(onChange).not.toHaveBeenCalled();expect(onError).toHaveBeenCalled();
 fireEvent.change(screen.getByRole("spinbutton",{name:"Relationship end"}),{target:{value:"4"}});expect(onChange.mock.calls.at(-1)![0].clips[0].motion.constraints[0].end).toBe(4);
 fireEvent.change(screen.getByRole("spinbutton",{name:"Relationship strength"}),{target:{value:"0.5"}});expect(onChange.mock.calls.at(-1)![0].clips[0].motion.constraints[0].weight).toBe(.5);
 fireEvent.change(screen.getByRole("combobox",{name:"Bend direction"}),{target:{value:"-1"}});expect(onChange.mock.calls.at(-1)![0].clips[0].motion.constraints[0].bend).toBe(-1);
});
test("registered skeleton nodes give structural guidance and activity respects timing",()=>{
 const {doc,node}=inspector("bone");expect(screen.getByText(/registered point/)).toBeVisible();expect(nodeActive(doc,node,-1)).toBe(false);expect(nodeActive(doc,{...node,enabled:false},1)).toBe(false);
 const graph=buildMotionGraph(doc);expect(nodeActive(doc,graph.nodes.find(n=>n.kind==="block")!,5)).toBe(false);expect(nodeActive(doc,graph.nodes.find(n=>n.kind==="constraint")!,4)).toBe(false);
});
test("object rename uses the canonical layer and missing node has guidance",()=>{
 const {onChange}=inspector("object");fireEvent.change(screen.getByRole("textbox",{name:"Node name"}),{target:{value:"Mira"}});expect(onChange.mock.calls.at(-1)![0].clips[0].name).toBe("Mira");cleanup();render(<MotionNodeInspector doc={scene()} node={undefined} time={0} onChange={vi.fn()} onError={vi.fn()}/>);expect(screen.getByText(/Select a node/)).toBeVisible();
});
function palette(clipId="actor", doc=scene()) {const onChange=vi.fn(),onError=vi.fn(),onSelectNode=vi.fn();render(<MotionRecipePalette doc={doc} clipId={clipId} time={0} onChange={onChange} onError={onError} onSelectNode={onSelectNode}/>);return {onChange,onError,onSelectNode};}
test.each(["Add target","Add lift","Add breathing"])("palette creates %s as an ordinary editable node",label=>{const {onChange,onSelectNode}=palette();fireEvent.click(screen.getByRole("button",{name:label}));expect(onChange).toHaveBeenCalledTimes(1);expect(onSelectNode).toHaveBeenCalled();});
test("palette asks for a limb then reports conflicting drivers safely",()=>{
 const {onChange,onError}=palette();fireEvent.click(screen.getByRole("button",{name:"Hand / foot reach"}));fireEvent.change(screen.getByRole("combobox",{name:"Recipe joint"}),{target:{value:"hand"}});fireEvent.click(screen.getByRole("button",{name:"Create relationship"}));expect(onChange).not.toHaveBeenCalled();expect(onError.mock.calls.at(-1)![0]).toMatch(/conflict/i);
});
test("palette builds gaze for an explicitly selected joint",()=>{
 const {onChange}=palette();fireEvent.click(screen.getByRole("button",{name:"Look at target"}));fireEvent.change(screen.getByRole("combobox",{name:"Recipe joint"}),{target:{value:"hand"}});fireEvent.click(screen.getByRole("button",{name:"Create relationship"}));expect(onChange.mock.calls.at(-1)![0].clips[0].motion.constraints.at(-1)).toMatchObject({type:"aim",boneId:"hand"});
});
test("palette attaches the selected prop to a chosen character socket",()=>{
 const {onChange}=palette("prop");fireEvent.click(screen.getByRole("button",{name:"Hold a prop"}));fireEvent.change(screen.getByRole("combobox",{name:"Attachment object"}),{target:{value:"actor"}});fireEvent.change(screen.getByRole("combobox",{name:"Attachment socket"}),{target:{value:"grip"}});fireEvent.click(screen.getByRole("button",{name:"Create relationship"}));expect(onChange.mock.calls.at(-1)![0].clips[1].motion.constraints[0]).toMatchObject({targetClipId:"actor",slotId:"grip"});
});
test("palette disables adding nodes when no layer is selected",()=>{
 palette("missing");expect(screen.getByRole("button",{name:"Add target"})).toBeDisabled();expect(screen.getByRole("button",{name:"Hand / foot reach"})).toBeDisabled();
});
