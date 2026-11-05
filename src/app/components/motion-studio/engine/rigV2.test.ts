// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { RigAsset } from "../types";
import { validateRig, transforms, matrix, inverse, setAnimationDuration, retimeKeys, keyTimes } from "./rig";
import { drawingVisibility, setDrawing, validateRigV2, upgradeRigToV2, pngInfo } from "./rigV2";
import { parseRigSvg } from "./rigSvg";
import { rigClipFrom } from "@/app/motion-studio/lib/rigImport";
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DQAAAEgQGALFXOsAAAAABJRU5ErkJggg==";
const fixture = (): RigAsset => ({ format:"mid-century-ink-rig", version:2, canvas:{width:100,height:100}, svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="front"/><g id="side"/></svg>', bones:[{id:"root",parentId:null,length:0,rest:{x:10,y:20,rotation:0}}], bindings:["front","side"].map(id=>({id,svgId:id,boneId:"root",bindMatrix:inverse(matrix(10,20,0))})), animations:[{id:"turn",duration:2,loop:true,tracks:[],drawingTracks:[{setId:"head",keys:[{time:0,drawingId:"front"},{time:1,drawingId:"side"},{time:2,drawingId:"front"}]}]}], rasterAttachments:[{id:"paint",svgId:"front",src:png,x:5,y:8,width:20,height:30}], drawingSets:[{id:"head",defaultDrawingId:"front",drawings:[{id:"front",svgIds:["front"]},{id:"side",svgIds:["side"]}]}] });
describe("Rig 2 illustrated attachments and registered drawings",()=>{
 it("counts injected raster nodes in the existing SVG element budget",()=>{
   const asset=fixture();
   asset.svg=asset.svg.replace('<g id="side"/>',`<g id="side">${'<path d="M0 0"/>'.repeat(2997)}</g>`);
   expect(parseRigSvg(asset).ok).toBe(false);
 });
 it("accepts Rig2 and still accepts the unchanged Rig1 master",()=>{
   expect(validateRig(fixture())).toEqual({ok:true,errors:[]});
   const old=JSON.parse(readFileSync(path.resolve(__dirname,"../../../../../docs/mci-rig/example-character.mci.json"),"utf8"));
   expect(validateRig(old).ok).toBe(true);
 });
 it("adds a trusted PNG after SVG parsing, retaining group order and coordinates",()=>{
   const parsed=parseRigSvg(fixture()); expect(parsed.ok).toBe(true); if(!parsed.ok)return;
   expect([...parsed.svg.groups.keys()]).toEqual(["front","side"]);
   expect(parsed.svg.groups.get("front")!.children[0]).toMatchObject({tag:"image",attrs:{href:png,x:"5",y:"8",width:"20",height:"30"}});
   expect(transforms(fixture(),{root:{x:4,y:3,rotation:0}}).front).toEqual([1,0,0,1,4,3]);
 });
 it("selects only registered groups, holds before a key and folds loop time",()=>{
   const asset=fixture();
   expect(drawingVisibility(asset,"turn",0)).toEqual({front:true,side:false});
   expect(drawingVisibility(asset,"turn",0.999)).toEqual({front:true,side:false});
   expect(drawingVisibility(asset,"turn",1)).toEqual({front:false,side:true});
   expect(drawingVisibility(asset,"turn",2)).toEqual({front:true,side:false});
 });
 it("edits discrete drawing keys immutably and round trips the editable master",()=>{
   const asset=fixture(); const edited=setDrawing(asset,"head","side","turn",0.5);
   expect(asset.animations[0].drawingTracks![0].keys).toHaveLength(3);
   expect(drawingVisibility(edited,"turn",0.5).side).toBe(true);
   const opened=rigClipFrom(JSON.parse(JSON.stringify(edited)),{width:100,height:100});
   expect(opened.ok).toBe(true); if(opened.ok)expect(JSON.stringify(opened.clip.rig)).toBe(JSON.stringify(edited));
   const manual=setDrawing(asset,"head","side",null,0);
   expect(drawingVisibility(manual,null,0)).toEqual({front:false,side:true});
 });
 it.each(["https://example.com/a.png","data:image/svg+xml;base64,PHN2Zy8+","data:image/png;base64,AAAA","data:image/png;base64,%%%"])("rejects unsupported raster payload %s",src=>{
   const asset=fixture(); asset.rasterAttachments![0].src=src; expect(validateRig(asset).ok).toBe(false); expect(parseRigSvg(asset).ok).toBe(false);
 });
 it("rejects extension fields in Rig1, invalid targets, duplicate set membership and bad key order",()=>{
   const asset=fixture(); expect(validateRig({...asset,version:1}).ok).toBe(false);
   expect(validateRig({...asset,rasterAttachments:[{...asset.rasterAttachments![0],svgId:"missing"}]}).ok).toBe(false);
   expect(validateRig({...asset,drawingSets:[{...asset.drawingSets![0],drawings:[{id:"front",svgIds:["front"]},{id:"side",svgIds:["front"]}]}]}).ok).toBe(false);
   expect(validateRig({...asset,animations:[{...asset.animations[0],drawingTracks:[{setId:"head",keys:[{time:1,drawingId:"front"},{time:0,drawingId:"side"}]}]}]}).ok).toBe(false);
 });
 it("keeps raw SVG image/event protections even for Rig2",()=>{
   for(const markup of ['<image href="'+png+'"/>','<g onclick="alert(1)"/>']) expect(parseRigSvg({...fixture(),svg:fixture().svg.replace('<g id="front"/>',markup)}).ok).toBe(false);
 });
 it("retimes drawing keys with clip duration and timeline dragging",()=>{
   const asset=fixture(); const longer=setAnimationDuration(asset,"turn",4);
   expect(longer.animations[0].drawingTracks![0].keys.map(k=>k.time)).toEqual([0,2,4]);
   expect(keyTimes(longer.animations[0])).toEqual([0,2,4]);
   const edited=retimeKeys(longer,"turn",null,2,3);
   expect(edited.animations[0].drawingTracks![0].keys.map(k=>k.time)).toEqual([0,3,4]);
   expect(validateRig(edited).ok).toBe(true);
 });
 it("upgrades Rig1 without changing artwork, motion or protected metadata",()=>{
   const old=JSON.parse(readFileSync(path.resolve(__dirname,"../../../../../docs/mci-rig/example-character.mci.json"),"utf8"));
   const asset=upgradeRigToV2(old); expect(old.version).toBe(1); expect(asset.version).toBe(2);
   expect({...asset,version:1}).toEqual(old); expect(validateRig(asset).ok).toBe(true);
 });
 it("bounds dimensions, total decoded pixels and payload integrity",()=>{
   expect(pngInfo(png)).toEqual({bytes:70,pixels:1});
   expect(pngInfo(png.slice(0,-4)+"AAAA")).toBeNull();
   const asset=fixture(); const bad={...asset,rasterAttachments:[{...asset.rasterAttachments![0],width:0}]};
   expect(validateRig(bad).ok).toBe(false);
   expect(validateRig({...asset,rasterAttachments:Array(129).fill(asset.rasterAttachments![0])}).ok).toBe(false);
 });
 it("agrees with the dependency-free shared runtime",()=>{
   const ref=createRequire(import.meta.url)(path.resolve(__dirname,"../../../../../docs/mci-rig/mci-rig-core.cjs"));
   expect(ref.validate(fixture())).toEqual(validateRig(fixture()));
   expect(ref.drawingVisibility(fixture(),"turn",1)).toEqual(drawingVisibility(fixture(),"turn",1));
   expect(validateRigV2(fixture())).toEqual([]);
 });
});
