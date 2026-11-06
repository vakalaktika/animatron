// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { motionValue } from "motion/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RigAsset, RigPose } from "../types";
import type { RigMeshAttachment } from "../engine/rigDeform";
import { RigDeformView } from "./RigDeformView";

const fixture = (): RigAsset & {meshes:RigMeshAttachment[]} => {
  const src = JSON.parse(readFileSync(path.resolve(__dirname,"../../../../../docs/mci-rig/example-illustrated-part.mci.json"),"utf8")).rasterAttachments[0].src;
  return {
    format:"mid-century-ink-rig",version:4 as RigAsset["version"],canvas:{width:100,height:100},svg:'<svg><g id="paint"/></svg>',
    bones:[{id:"root",parentId:null,rest:{x:0,y:0,rotation:0},length:40},{id:"arm",parentId:"root",rest:{x:40,y:0,rotation:0},length:40}],
    bindings:[{id:"paint-bind",boneId:"root",svgId:"paint",bindMatrix:[1,0,0,1,0,0]}],
    rasterAttachments:[{id:"raster",svgId:"paint",src,x:0,y:0,width:80,height:40}],animations:[],
    meshes:[{id:"mesh",rasterId:"raster",vertices:[{x:0,y:0,weights:[{boneId:"root",weight:1}]},{x:80,y:0,weights:[{boneId:"arm",weight:1}]},{x:0,y:40,weights:[{boneId:"root",weight:1}]}],triangles:[[0,1,2]]}],
  };
};

describe("RigDeformView",()=>{
  it("renders only validated PNGs in registered paint order and changes the triangle map on pose edits",async()=>{
    const asset=fixture(), pose=motionValue<RigPose>({});
    const visibility=motionValue<Record<string,boolean>>({paint:true});
    const {container,unmount}=render(<svg><RigDeformView asset={asset} mesh={asset.meshes[0]} pose={pose} visibility={visibility}/></svg>);
    const part=container.querySelector('[data-rig-part="paint"]')!;
    expect(part).not.toBeNull();
    expect(part.querySelector("image")?.getAttribute("href")).toBe(asset.rasterAttachments![0].src);
    const triangle=part.querySelector("[data-mesh-triangle]")!;
    expect(triangle.getAttribute("transform")).toBe("matrix(1 0 0 1 0 0)");
    await act(async()=>{pose.set({arm:{x:0,y:0,rotation:45}}); await new Promise(resolve=>setTimeout(resolve,30));});
    expect(triangle.getAttribute("transform")).not.toBe("matrix(1 0 0 1 0 0)");
    await act(async()=>{visibility.set({paint:false}); await new Promise(resolve=>setTimeout(resolve,30));});
    expect(part.getAttribute("opacity")).toBe("0");
    unmount();
  });
  it("fails closed for an unsafe texture or unsupported version",()=>{
    const asset=fixture(); asset.rasterAttachments![0].src="https://invalid/image.png";
    const first=render(<svg><RigDeformView asset={asset} mesh={asset.meshes[0]} pose={motionValue({})}/></svg>);
    expect(first.container.querySelector("image")).toBeNull(); first.unmount();
    const old=fixture(); old.version=3;
    const second=render(<svg><RigDeformView asset={old} mesh={old.meshes[0]} pose={motionValue({})}/></svg>);
    expect(second.container.querySelector("image")).toBeNull(); second.unmount();
  });
  it("hides a collapsed posed triangle and restores it when the bend becomes drawable",async()=>{
    const asset=fixture(), pose=motionValue<RigPose>({arm:{x:0,y:0,rotation:180}});
    const {container,unmount}=render(<svg><RigDeformView asset={asset} mesh={asset.meshes[0]} pose={pose}/></svg>);
    const triangle=container.querySelector("[data-mesh-triangle]")!;
    expect(triangle.getAttribute("opacity")).toBe("0");
    await act(async()=>{pose.set({}); await new Promise(resolve=>setTimeout(resolve,30));});
    expect(triangle.getAttribute("opacity")).toBe("1");
    await act(async()=>{pose.set({arm:{x:0,y:0,rotation:180}}); await new Promise(resolve=>setTimeout(resolve,30));});
    expect(triangle.getAttribute("opacity")).toBe("0");
    expect(triangle.getAttribute("transform")).toBe("");
    unmount();
  });
});
