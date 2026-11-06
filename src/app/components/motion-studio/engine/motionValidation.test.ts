import { makeText } from "@/app/motion-studio/presets";
import { validateMotionDocument, validateRigMotion } from "./motionValidation";
import { timelineErrors } from "./motionTimeline";
import type { StudioDoc } from "../types";
import {readFileSync} from "node:fs";
import {authoredClipEnd} from "./motionTimeline";

const fixture=():StudioDoc=>({version:4,name:"Validation",stage:{width:100,height:100,background:"#fff",transparent:false},clips:[{...makeText({id:"7object",start:0}),motion:{controllers:[{id:"target",space:"stage",x:20,y:30}],blocks:[],constraints:[]}}]});
const check=(motion:unknown)=>validateMotionDocument({...fixture(),clips:[{...fixture().clips[0],motion}]});
const move={id:"move",type:"transform",start:0,duration:2,from:{x:0},to:{x:10}};

describe("motion payload safety and bounded resources",()=>{
 it.each([
  null,[],{execute:"code"},{blocks:{}},{controllers:[] ,blocks:[null]},
  {controllers:[{id:"1bad",space:"stage",x:0,y:0}]},
  {controllers:[{id:"t",space:"stage",x:0,y:0},{id:"t",space:"stage",x:0,y:0}]},
  {controllers:[{id:"t",name:1,space:"stage",x:0,y:0}]},
  {controllers:[{id:"t",space:"camera",x:0,y:0}]},
  {controllers:[{id:"t",space:"stage",x:0,y:0,clipId:"other"}]},
  {controllers:[{id:"t",space:"object",x:0,y:0,clipId:"bad/remote"}]},
  {controllers:[{id:"t",space:"stage",x:0,y:0,keys:{scale:[]}}]},
  {blocks:[{...move,enabled:"yes"}]},{blocks:[{...move,name:"x".repeat(201)}]},
  {blocks:[{...move,repeat:0}]},{blocks:[{...move,repeat:101}]},{blocks:[{...move,repeat:1.5}]},
  {blocks:[{...move,start:599,duration:2}]},{blocks:[{...move,alternate:1}]},
  {blocks:[{...move,ease:{name:"script"}}]},
  {blocks:[{...move,ease:{name:"custom",custom:[2,0,1,1]}}]},
  {blocks:[{...move,from:{width:3}}]},
  {blocks:[{id:"p",type:"path",start:0,duration:1,points:[{x:0,y:0}]}]},
  {blocks:[{id:"p",type:"path",start:0,duration:1,points:[{x:0,y:0},{x:1,y:1}],closed:1}]},
  {blocks:[{id:"o",type:"oscillate",start:0,duration:1,property:"height",amplitude:1}]},
  {blocks:[{id:"o",type:"oscillate",start:0,duration:1,property:"x",amplitude:1,cycles:0}]},
  {constraints:[{id:"c",type:"aim",boneId:"head",targetId:"missing",weight:2}]},
  {constraints:[{id:"c",type:"aim",boneId:"head",targetId:"missing",start:2,end:1}]},
  {constraints:[{id:"c",type:"ik",rootId:"a",midId:"b",tipId:"c",targetId:"t",bend:0}]},
  {constraints:[{id:"c",type:"attach",targetClipId:"7object",offset:{x:0,y:0}}]},
  {constraints:[{id:"c",type:"script",expression:"alert(1)"}]},
  {controllers:Array.from({length:129},(_,i)=>({id:`t${i}`,space:"stage",x:0,y:0}))},
 ])("rejects malformed or executable program %#",program=>expect(check(program).length).toBeGreaterThan(0));
 it("bounds combined keys, not just individual tracks",()=>{
  const keys=Array.from({length:6000},(_,i)=>({time:i/10,value:0}));
  expect(check({controllers:[{id:"t",space:"stage",x:0,y:0,keys:{x:keys,y:keys}}]}).join(" ")).toMatch(/combined/);
 });
 it("rejects missing controller, parent and object/socket dependencies",()=>{
  expect(check({blocks:[{...move,controllerId:"missing"}]}).join(" ")).toMatch(/Missing controller/);
  expect(check({controllers:[{id:"t",space:"object",x:0,y:0,clipId:"missing",slotId:"grip"}]}).join(" ")).toMatch(/Missing/);
  const doc=fixture();doc.clips[0].parentId="missing";expect(validateMotionDocument(doc).join(" ")).toMatch(/parent/);
 });
 it("accepts references to existing numeric-leading legacy clip IDs",()=>{
  const doc=fixture();doc.clips.push({...makeText({id:"held",start:0}),motion:{constraints:[{id:"attach",type:"attach",targetClipId:"7object",offset:{x:0,y:0,rotation:0}}]}});
  expect(validateMotionDocument(doc)).toEqual([]);
 });
 it("rejects duplicate clips and an oversized graph",()=>{
  const doc=fixture();expect(validateMotionDocument({...doc,clips:[...doc.clips,...doc.clips]}).join(" ")).toMatch(/unique/);
  expect(validateMotionDocument({...doc,clips:Array.from({length:513},(_,i)=>({...doc.clips[0],id:`c${i}`}))}).join(" ")).toMatch(/512/);
 });
 it("bounds aggregate illustrated payloads before evaluating a motion graph",()=>{
  expect(validateMotionDocument({...fixture(),metadata:{oversized:"x".repeat(16_000_001)}}).join(" ")).toMatch(/budget/);
 });
 it("validates standalone portable program spaces and unknown collections",()=>{
  expect(validateRigMotion({version:3,motion:{controllers:[{id:"t",space:"rig",x:0,y:0}]}}).join(" ")).toMatch(/version 4/);
  expect(validateRigMotion({version:4,motion:{constraints:[{id:"a",type:"attach",targetClipId:"elsewhere",offset:{x:0,y:0,rotation:0}}]}}).join(" ")).toMatch(/portable/i);
  expect(validateMotionDocument(null).length).toBeGreaterThan(0);
 });
 it("checks exact timing independently of the presence of motion operators",()=>{
  const doc=fixture();
  for(const duration of [0,-1,601,NaN])expect(timelineErrors({...doc,timeline:{tailSeconds:0,duration}}).length).toBeGreaterThan(0);
  expect(timelineErrors({...doc,version:3,timeline:{tailSeconds:0,duration:8,loop:true}}).length).toBeGreaterThan(0);
  expect(timelineErrors({...doc,timeline:null as never}).length).toBeGreaterThan(0);
  expect(timelineErrors({...doc,timeline:{tailSeconds:61,loop:"yes" as never}}).length).toBeGreaterThan(0);
  expect(timelineErrors({...doc,timeline:{duration:8,loop:false,tailSeconds:0}})).toEqual([]);
 });
 it("includes bone and replacement-drawing keys in exact scene timing",()=>{
  const doc=JSON.parse(readFileSync('examples/motion-pipeline/original-bedtime.animatron.json','utf8')) as StudioDoc;
  expect(authoredClipEnd(doc.clips[0])).toBe(8);
  expect(timelineErrors({...doc,timeline:{duration:7,loop:true,tailSeconds:0}}).join(' ')).toMatch(/cuts off/);
 });
});
