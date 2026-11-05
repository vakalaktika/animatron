import { readFileSync } from "node:fs";
import type { StudioDoc, RigClip } from "../types";
import { inverse, world } from "./rig";
import { parseImport } from "@/app/motion-studio/presets";
import { pointInStageMask } from "./stageMask";
import { reviewScene } from "./sceneReview";
const source=()=>JSON.parse(readFileSync(new URL("../../../../../examples/tween-studio/sunroom-tween.animatron.json",import.meta.url),"utf8")) as StudioDoc;
test("rejects reversed visible travel and outside actors lacking an actual portal",()=>{
 const result=reviewScene(source(),{version:1,actors:[],travels:[{clipId:"outside-bird",boneId:"bird",restFacing:"right",mode:"forward",space:"exterior"}]});
 expect(result.issues.map(i=>i.code)).toEqual(expect.arrayContaining(["backward-travel","missing-portal"]));
});
test("refuses natural articulated acting unsupported by the prepared artwork",()=>{
 const result=reviewScene(source(),{version:1,travels:[],actors:[{clipId:"scene",action:"articulated",requiredParts:["torso","upper-arm","forearm","hand","head"]}]});
 expect(result.ok).toBe(false);
 expect(result.issues.some(i=>i.code==="missing-articulation")).toBe(true);
});
test("permits scoped rigid gestures and forward exterior movement, ignoring invisible reset",()=>{
 const doc=source(),bird=doc.clips[2] as RigClip;
 bird.stageMask={regions:[[{x:500,y:0},{x:1500,y:0},{x:1500,y:300},{x:500,y:300}]]};
 bird.rig.animations[0].tracks[0].keys=bird.rig.animations[0].tracks[0].keys.map(k=>({...k,x:-k.x}));
 const result=reviewScene(doc,{version:1,actors:[{clipId:"scene",action:"rigid",requiredParts:["lift"]}],travels:[{clipId:"outside-bird",boneId:"bird",restFacing:"right",mode:"forward",space:"exterior"}]});
 expect(result.issues).toEqual([]);expect(result.ok).toBe(true);
});
test("untrusted plans fail clearly and have bounded evaluation",()=>{
 for(const plan of [null,{version:1,actors:"x"},{version:9}, {version:1,actors:[],travels:[{clipId:"missing",restFacing:"right",space:"interior",mode:"forward"}]}])expect(reviewScene(source(),plan).ok).toBe(false);
});

test("an explicitly prepared articulated object passes without a universal human skeleton",()=>{
 const doc=JSON.parse(readFileSync(new URL("../../../../../examples/tween-studio/lamp.animatron.json",import.meta.url),"utf8")) as StudioDoc;
 expect(reviewScene(doc,{version:1,actors:[{clipId:"lamp",action:"articulated",requiredParts:["lower","upper","shade"]}],travels:[]}).ok).toBe(true);
});

test("invalid stored production intent cannot masquerade as an imported valid plan",()=>{
 expect(parseImport({...source(),version:3,scenePlan:{version:1,actors:"invalid",travels:[]}}).kind).toBe("error");
});

test("an empty motion plan cannot produce a misleading success",()=>{
 expect(reviewScene(source(),{version:1,actors:[],travels:[]}).issues[0].code).toBe("undeclared-plan");
});

test("artwork facing is relative to the rest drawing, not a rotated construction bone",()=>{
 const doc=source(),bird=doc.clips[2] as RigClip;
 bird.rig.bones.find(b=>b.id==="bird")!.rest.rotation=90;
 bird.rig.animations[0].tracks[0].keys=bird.rig.animations[0].tracks[0].keys.map(k=>({...k,y:0,rotation:0}));
 bird.rig.bindings=bird.rig.bindings.map(b=>({...b,bindMatrix:inverse(world(bird.rig)[b.boneId])}));
 const result=reviewScene(doc,{version:1,actors:[],travels:[{clipId:"outside-bird",boneId:"bird",restFacing:"right",mode:"forward",space:"interior"}]});
 expect(result.issues.map(i=>i.code)).toContain("backward-travel");
});

test("unrelated moving controls cannot satisfy the declared articulation",()=>{
 const doc=JSON.parse(readFileSync(new URL("../../../../../examples/tween-studio/lamp.animatron.json",import.meta.url),"utf8")) as StudioDoc;
 expect(reviewScene(doc,{version:1,actors:[{clipId:"lamp",action:"articulated",requiredParts:["root","lower"]}],travels:[]}).issues.map(i=>i.code)).toContain("rigid-carrier");
});

test("the example aperture keeps the actual window mullion in front",()=>{
 const doc=JSON.parse(readFileSync(new URL("../../../../../examples/scene-structure/sunroom-structured.animatron.json",import.meta.url),"utf8")) as StudioDoc;
 const mask=doc.clips.find(c=>c.id==="outside-bird")!.stageMask!;
 expect(pointInStageMask(mask,{x:745,y:190})).toBe(false);
 expect(pointInStageMask(mask,{x:700,y:190})).toBe(true);
 expect(pointInStageMask(mask,{x:800,y:190})).toBe(true);
 expect(reviewScene(doc).ok).toBe(true);
});
