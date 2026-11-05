import { readFileSync } from "node:fs";
import type { StudioDoc, RigClip } from "../types";
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
