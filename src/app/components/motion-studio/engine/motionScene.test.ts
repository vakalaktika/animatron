import { describe, expect, it } from "vitest";
import type { RigClip, StudioDoc } from "../types";
import { applyMatrix, world } from "./rig";
import { evaluateScene, motionEnd, motionProgram, controllerLocalPoint, targetSocketTransform } from "./motionScene";
import { validateMotionDocument, validateRigMotion } from "./motionValidation";

const rig = (): RigClip => ({
  id: "actor", name: "Actor", enabled: true, type: "rig", start: 0, x: 100, y: 100, scale: 1,
  parentId: null, followRotation: true, animationId: null, pose: {},
  rig: { format: "mid-century-ink-rig", version: 4, canvas: {width: 200,height: 200}, svg: '<svg viewBox="0 0 200 200"><g id="arm"/></svg>',
    bindings: [], animations: [], bones: [
      {id:"body",parentId:null,rest:{x:100,y:100,rotation:0},length:0},
      {id:"upper",parentId:"body",rest:{x:0,y:0,rotation:0},length:50},
      {id:"fore",parentId:"upper",rest:{x:50,y:0,rotation:0},length:50},
      {id:"hand",parentId:"fore",rest:{x:50,y:0,rotation:0},length:0},
    ] },
});
const doc = (actor = rig()): StudioDoc => ({version:4,name:"Motion",stage:{width:400,height:300,background:"#fff",transparent:false},clips:[actor]});
const hand = (asset: RigClip, pose: Record<string,{x:number;y:number;rotation:number}>) => applyMatrix(world(asset.rig,pose).hand,{x:0,y:0});

describe("persistent motion evaluation", () => {
  it("keeps legacy placement and pose unchanged", () => {
    const scene = doc(); const at=evaluateScene(scene,1);
    expect(at.transforms.actor.x).toBe(100); expect(at.poses.actor).toEqual({}); expect(at.diagnostics).toEqual([]);
  });
  it("solves an IK target at an intermediate time while the body moves", () => {
    const actor=rig(); actor.pose={body:{x:20,y:0,rotation:0}};
    actor.motion={controllers:[{id:"grip",space:"rig",x:150,y:150}],constraints:[{id:"reach",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"grip",bend:1}]};
    const at=evaluateScene(doc(actor),0.5); const actual=hand(actor,at.poses.actor);
    expect(Math.hypot(actual.x-150,actual.y-150)).toBeLessThan(0.001);
  });
  it("samples a controller's sparse target keys and deterministic reverse seeks", () => {
    const actor=rig(); actor.motion={controllers:[{id:"grip",space:"rig",x:150,y:100,keys:{y:[{time:0,value:100,ease:{name:"linear"}},{time:2,value:150,ease:{name:"linear"}}]}}],constraints:[{id:"reach",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"grip",bend:-1}]};
    const scene=doc(actor); evaluateScene(scene,1.8); const at=evaluateScene(scene,1); expect(hand(actor,at.poses.actor).y).toBeCloseTo(125,5);
    expect(evaluateScene(scene,1)).toEqual(at);
  });
  it("adds a reusable path to keyed placement without discarding the keys", () => {
    const actor=rig(); actor.keys={x:[{time:0,value:100,ease:{name:"linear"}},{time:2,value:120,ease:{name:"linear"}}]};
    actor.motion={blocks:[{id:"travel",type:"path",start:0,duration:2,points:[{x:0,y:0},{x:80,y:0}],ease:{name:"linear"}}]};
    expect(evaluateScene(doc(actor),1).transforms.actor.x).toBeCloseTo(150,2);
    expect(actor.keys.x).toHaveLength(2); expect(motionEnd(actor)).toBe(2);
  });
  it("resolves an object-space target through a moving prop and keeps the attached grip", () => {
    const actor=rig(); const prop={...rig(),id:"plane",x:150,y:120,rig:{...rig().rig,motion:undefined},motion:{blocks:[{id:"lift",type:"transform" as const,start:0,duration:2,from:{y:0},to:{y:20},ease:{name:"linear" as const}}]}};
    actor.motion={controllers:[{id:"grip",space:"object",clipId:"plane",x:0,y:0}],constraints:[{id:"reach",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"grip",bend:1}]};
    const scene={...doc(actor),clips:[actor,prop]}; const at=evaluateScene(scene,1); const actual=hand(actor,at.poses.actor);
    expect(actual.x).toBeCloseTo(150,4); expect(actual.y).toBeCloseTo(130,4);
  });
  it("reports impossible reaches and preserves lengths rather than stretching", () => {
    const actor=rig(); actor.motion={controllers:[{id:"far",space:"rig",x:500,y:500}],constraints:[{id:"reach",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"far",bend:1}]};
    const at=evaluateScene(doc(actor),1); expect(at.diagnostics.some(x=>x.code==="unreachable")).toBe(true);
    const actual=hand(actor,at.poses.actor); expect(Math.hypot(actual.x-100,actual.y-100)).toBeCloseTo(100,3);
  });
  it("applies interval and influence without carrying state across a seek", () => {
    const actor=rig(); actor.motion={controllers:[{id:"grip",space:"rig",x:150,y:150}],constraints:[{id:"reach",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"grip",bend:1,start:1,end:2}]};
    const scene=doc(actor); expect(evaluateScene(scene,0.5).poses.actor).toEqual({}); expect(hand(actor,evaluateScene(scene,1.5).poses.actor).y).toBeCloseTo(150,5); expect(evaluateScene(scene,2.5).poses.actor).toEqual({});
  });
  it("merges portable controls with instance overrides by id", () => {
    const actor=rig(); actor.rig.motion={controllers:[{id:"grip",space:"rig",x:10,y:20}]}; actor.motion={controllers:[{id:"grip",space:"rig",x:30,y:40}]};
    expect(motionProgram(actor).controllers).toHaveLength(1); expect(motionProgram(actor).controllers[0].x).toBe(30);
  });
  it("releases an attachment without snapping to the unmodified base motion", () => {
    const actor=rig(); const prop={...rig(),id:"plane",x:150,y:120,motion:{blocks:[{id:"travel",type:"transform" as const,start:0,duration:4,from:{x:0},to:{x:40},ease:{name:"linear" as const}}]}};
    actor.motion={constraints:[{id:"grip",type:"attach",targetClipId:"plane",start:0,end:2,offset:{x:0,y:0,rotation:0}}]};
    const scene={...doc(actor),clips:[actor,prop]};
    const before=evaluateScene(scene,2).transforms.actor,after=evaluateScene(scene,2.00001).transforms.actor;
    expect(after.x).toBeCloseTo(before.x,3);expect(after.y).toBeCloseTo(before.y,3);
    expect(evaluateScene(scene,3).transforms.actor.x).toBeCloseTo(before.x,3);
  });
  it("aims a bone with partial influence and preserves explicit limits",()=>{
    const actor=rig();actor.rig.bones[1].limits={min:-10,max:10};
    actor.motion={controllers:[{id:"look",space:"rig",x:100,y:180}],constraints:[{id:"aim",type:"aim",boneId:"upper",targetId:"look",weight:.5,offset:0}]};
    expect(evaluateScene(doc(actor),1).poses.actor.upper.rotation).toBe(10);
  });
  it("evaluates reusable transforms, oscillation and alternate path repeats",()=>{
    const actor=rig();actor.motion={controllers:[{id:"t",space:"stage",x:10,y:20}],blocks:[
      {id:"path",type:"path",start:0,duration:1,repeat:2,alternate:true,points:[{x:0,y:0},{x:20,y:0}],orient:true,facingOffset:12,ease:{name:"linear"}},
      {id:"breath",type:"oscillate",start:0,duration:2,property:"y",amplitude:4,cycles:1,ease:{name:"linear"}},
      {id:"target",controllerId:"t",type:"transform",start:0,duration:2,from:{rotation:0},to:{rotation:30},ease:{name:"linear"}},
      {id:"disabled",type:"transform",enabled:false,start:0,duration:100,from:{x:0},to:{x:100}},
    ]};
    const scene=doc(actor),half=evaluateScene(scene,.5);
    expect(half.transforms.actor.x).toBeCloseTo(110);
    expect(half.transforms.actor.y).toBeCloseTo(104);
    expect(half.transforms.actor.rotation).toBeCloseTo(12);
    expect(half.controllers.actor.t.rotation).toBeCloseTo(7.5);
    expect(evaluateScene(scene,2).transforms.actor.x).toBeCloseTo(100);
    expect(evaluateScene(scene,-1).transforms.actor.x).toBe(100);
    expect(motionEnd(actor)).toBe(2);
  });
  it("maps rig and socket controller handles through mirrored transformed parents",()=>{
    const actor=rig();actor.rig.slots=[{id:"grip",boneId:"hand",x:5,y:0,rotation:10}];
    actor.scale=-2;actor.rotation=20;
    actor.motion={controllers:[{id:"local",space:"rig",x:150,y:100}]};
    const scene=doc(actor),at=evaluateScene(scene,1),point=at.controllers.actor.local;
    expect(controllerLocalPoint(scene,"actor","local",point,1)).toMatchObject({x:expect.closeTo(150,4),y:expect.closeTo(100,4)});
    const socket=targetSocketTransform(scene,"actor","grip",1);
    expect(Number.isFinite(socket.x)).toBe(true);
    expect(controllerLocalPoint(scene,"missing","missing",{x:1,y:2},1)).toEqual({x:1,y:2});
    expect(targetSocketTransform(scene,"missing",undefined,1).x).toBe(0);
  });
  it("keys controller rotations and maps referenced socket targets",()=>{
    const actor=rig(),prop={...rig(),id:"prop",x:120,y:90};prop.rig.slots=[{id:"grip",boneId:"hand",x:0,y:0,rotation:0}];
    actor.motion={controllers:[{id:"target",space:"object",clipId:"prop",slotId:"grip",x:3,y:4,keys:{rotation:[{time:0,value:0,ease:{name:"linear"}},{time:2,value:20,ease:{name:"linear"}}]}}]};
    const scene={...doc(actor),clips:[prop,actor]},point=evaluateScene(scene,1).controllers.actor.target;
    expect(point.rotation).toBeCloseTo(10);
    expect(controllerLocalPoint(scene,actor.id,"target",point,1)).toMatchObject({x:expect.closeTo(3,4),y:expect.closeTo(4,4)});
  });
  it("fails closed for invalid in-memory operators and normalizes nonfinite seek time",()=>{
    const actor=rig();actor.motion={blocks:[{id:"bad",type:"script"} as never]};
    expect(evaluateScene(doc(actor),NaN).diagnostics[0].code).toBe("invalid");
    expect(evaluateScene(doc(actor),NaN).transforms.actor.x).toBe(100);
  });
  it("reports degenerate limbs and contact errors caused by joint limits",()=>{
    const actor=rig();actor.rig.bones[2].rest.x=0;
    actor.motion={controllers:[{id:"t",space:"rig",x:120,y:150}],constraints:[{id:"ik",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"t",bend:1}]};
    expect(evaluateScene(doc(actor),1).diagnostics.some(d=>d.code==="unreachable")).toBe(true);
    const limited=rig();limited.rig.bones[1].limits={min:0,max:0};limited.rig.bones[2].limits={min:0,max:0};limited.motion=actor.motion;
    expect(evaluateScene(doc(limited),1).diagnostics.some(d=>d.code==="contact")).toBe(true);
  });
  it("honors zero weights, disabled contacts and follow-rotation choices",()=>{
    const actor=rig();actor.motion={controllers:[{id:"t",space:"rig",x:130,y:150}],constraints:[{id:"ik",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"t",bend:1,weightKeys:[{time:0,value:0,ease:{name:"linear"}}]}]};
    expect(evaluateScene(doc(actor),1).poses.actor).toEqual({});
    actor.motion.constraints![0].enabled=false;
    expect(evaluateScene(doc(actor),1).poses.actor).toEqual({});
    const prop={...rig(),id:"prop",rotation:90};actor.rotation=12;actor.motion={constraints:[{id:"a",type:"attach",targetClipId:"prop",followRotation:false,offset:{x:5,y:0,rotation:0}}]};
    expect(evaluateScene({...doc(actor),clips:[actor,prop]},1).transforms.actor.rotation).toBe(12);
  });
  it("keeps a planted endpoint fixed through an animated root and partial contact release",()=>{
    const actor=rig();actor.animationId="shift";actor.rig.animations=[{id:"shift",duration:2,loop:false,tracks:[{boneId:"body",keys:[{time:0,x:0,y:0,rotation:0,easing:"linear"},{time:2,x:20,y:5,rotation:8,easing:"linear"}]}]}];
    actor.motion={controllers:[{id:"foot",space:"stage",x:155,y:145}],constraints:[{id:"plant",type:"ik",rootId:"upper",midId:"fore",tipId:"hand",targetId:"foot",bend:1,end:2,weightKeys:[{time:0,value:1},{time:2,value:1}]}]};
    const scene=doc(actor);
    for(let i=0;i<=30;i++){const at=evaluateScene(scene,2*i/30),p=hand(actor,at.poses.actor);expect(Math.hypot(p.x-155,p.y-145)).toBeLessThan(.001);}
    const relaxed={...actor,motion:{...actor.motion,constraints:actor.motion.constraints!.map(c=>({...c,weightKeys:undefined,weight:.5}))}};
    expect(evaluateScene(doc(relaxed),1).diagnostics).toEqual([]);
    expect(motionEnd(actor)).toBe(2);
  });
});

describe("motion import boundaries", () => {
  it("accepts the bounded declared format", () => expect(validateMotionDocument(doc())).toEqual([]));
  it("rejects old documents carrying new motion", () => { const scene=doc(); scene.clips[0].motion={controllers:[]}; expect(validateMotionDocument({...scene,version:3}).join(" ")).toMatch(/version 4/i); });
  it("rejects executable or unknown operators", () => { const scene=doc(); scene.clips[0].motion={blocks:[{id:"evil",type:"script"} as never]}; expect(validateMotionDocument(scene).length).toBeGreaterThan(0); });
  it("rejects nonfinite and badly ordered keys", () => { const actor=rig(); actor.motion={controllers:[{id:"bad",space:"stage",x:NaN,y:0,keys:{x:[{time:1,value:0,ease:{name:"linear"}},{time:0,value:1,ease:{name:"linear"}}]}}]}; expect(validateMotionDocument(doc(actor)).length).toBeGreaterThan(0); });
  it("rejects dependency cycles", () => { const a=rig(); const b={...rig(),id:"other"}; a.motion={constraints:[{id:"a",type:"attach",targetClipId:b.id,offset:{x:0,y:0,rotation:0}}]}; b.motion={constraints:[{id:"b",type:"attach",targetClipId:a.id,offset:{x:0,y:0,rotation:0}}]}; expect(validateMotionDocument({...doc(a),clips:[a,b]}).join(" ")).toMatch(/cycle/i); });
  it("rejects external references in portable rigs", () => { const asset=rig().rig; asset.motion={controllers:[{id:"target",space:"object",clipId:"missing",x:0,y:0}]}; expect(validateRigMotion(asset).join(" ")).toMatch(/portable|external|rig space/i); });
});
