// @vitest-environment jsdom
import { parseRigSvg } from "./rigSvg";
import { validateRig } from "./rig";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture=()=>JSON.parse(readFileSync(resolve("docs/mci-rig/example-illustrated-part.mci.json"),"utf8"));
describe("registered PNG atlas attachments",()=>{
  it("resolves a bounded shared PNG and crops only the selected registered source rectangle",()=>{
    const rig=fixture();rig.version=4;
    const part=rig.rasterAttachments[0];
    rig.rasterSources=[{id:"paint",src:part.src}];
    part.src="@paint";part.sourceRect={x:0,y:0,width:1,height:1};
    expect(validateRig(rig).ok).toBe(true);
    const parsed=parseRigSvg(rig);
    expect(parsed.ok).toBe(true);
    if(parsed.ok)expect(JSON.stringify(parsed.svg)).toContain('viewBox');
    rig.version=3;
    expect(validateRig(rig).ok).toBe(false);
  });
  it("rejects missing sources and out-of-bounds crops",()=>{
    const rig=fixture();rig.version=4;
    rig.rasterAttachments[0].src="@missing";
    expect(validateRig(rig).ok).toBe(false);
    const second=fixture();second.version=4;
    second.rasterAttachments[0].sourceRect={x:5000,y:0,width:1,height:1};
    expect(validateRig(second).ok).toBe(false);
  });
});
