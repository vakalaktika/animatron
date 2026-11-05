// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { validateRig, sample, world, applyMatrix } from "@/app/components/motion-studio/engine/rig";
import { rigClipFrom } from "@/app/motion-studio/lib/rigImport";
import { docFromJson } from "@/app/motion-studio/lib/importDoc";

import { docDuration } from "@/app/components/motion-studio/engine/timing";
import type { RigClip, StudioDoc } from "@/app/components/motion-studio/types";
const read = (p: string) => JSON.parse(readFileSync(new URL("../../../../../examples/tween-studio/"+p, import.meta.url), "utf8"));
const lamp = read("./lamp.animatron.json") as StudioDoc;
const room = read("./sunroom-tween.animatron.json") as StudioDoc;
const old = read("../illustrated-scenes/sunroom-glider/sunroom-glider.animatron.json") as StudioDoc;
const rigs = (doc: StudioDoc) => doc.clips.filter((c): c is RigClip => c.type === "rig");
describe("editable sparse tween fixtures", () => {
 test.each([[lamp,6],[room,8]] as const)("imports, saves and reopens without losing sparse curves", (doc, duration) => {
  for (const clip of rigs(doc)) {
   expect(validateRig(clip.rig)).toEqual({ok:true,errors:[]});
   expect(rigClipFrom(clip.rig,doc.stage).ok).toBe(true);
  }
  const imported=docFromJson(JSON.stringify(doc),"test.json");
  expect(imported.ok).toBe(true);
  if(imported.ok) { expect(imported.warnings).toEqual([]); expect(imported.doc).toEqual(doc); }
  expect(docDuration(doc)).toBe(duration);
 });
 test("independent lamp tracks articulate while shared pivots remain exact", () => {
  const rig=rigs(lamp)[0].rig;
  expect(rig.animations[0].tracks.reduce((n,t)=>n+t.keys.length,0)).toBe(15);
  for (let time=0;time<6;time+=1/48) {
   const w=world(rig,sample(rig,"lamp",time));
   const tip=applyMatrix(w.lower,{x:165,y:0});
   const elbow=applyMatrix(w.upper,{x:0,y:0});
   expect(tip.x).toBeCloseTo(elbow.x,8);
   expect(tip.y).toBeCloseTo(elbow.y,8);
   const upperTip=applyMatrix(w.upper,{x:185,y:0});
   const shade=applyMatrix(w.shade,{x:0,y:0});
   expect(upperTip.x).toBeCloseTo(shade.x,8);
   expect(upperTip.y).toBeCloseTo(shade.y,8);
  }
  expect(sample(rig,"lamp",0.75).lower.rotation).toBeCloseTo(6);
  expect(sample(rig,"lamp",0.75).shade.rotation).not.toBeCloseTo(6);
 });
 test("preserves illustration assets, drawings, hand-plane carrier and static scene", () => {
  rigs(room).forEach((clip,i)=>{
   const before=rigs(old)[i];
   expect(clip.rig.svg).toBe(before.rig.svg);
   expect(clip.rig.rasterAttachments).toEqual(before.rig.rasterAttachments);
   expect(clip.rig.bindings).toEqual(before.rig.bindings);
   expect(clip.rig.drawingSets).toEqual(before.rig.drawingSets);
   expect(clip.rig.animations[0].drawingTracks).toEqual(before.rig.animations[0].drawingTracks);
  });
  const clip=rigs(room)[1];
  expect(clip.rig.bindings.find(b=>b.svgId==="lift")?.boneId).toBe("lift");
  expect(clip.rig.animations[0].tracks[0].keys).toHaveLength(8);
  expect(rigs(room)[2].rig.animations[0].tracks[0].keys).toHaveLength(6);
 });
 test("active motions have quiet loop seams; bird resets only while hidden", () => {
  for(const [doc,duration] of [[lamp,6],[room,8]] as const) {
   const clip=rigs(doc).find(c=>c.id==="lamp"||c.id==="scene")!;
   const animation=clip.rig.animations[0];
   expect(sample(clip.rig,animation.id,0)).toEqual(sample(clip.rig,animation.id,duration));
   const at=sample(clip.rig,animation.id,0), after=sample(clip.rig,animation.id,0.001), before=sample(clip.rig,animation.id,duration-0.001);
   for(const id of Object.keys(at)) {
    expect(Math.abs(after[id].rotation-at[id].rotation)/0.001).toBeLessThan(0.05);
    expect(Math.abs(at[id].rotation-before[id].rotation)/0.001).toBeLessThan(0.05);
   }
  }
  const bird=rigs(room)[2];
  const opacity=bird.keys!.opacity!;
  expect(opacity.find(k=>k.time===6)?.value).toBe(0);
  expect(opacity.at(-1)?.value).toBe(0);
 });
});
