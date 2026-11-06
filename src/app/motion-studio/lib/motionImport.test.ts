import { makeText, welcomePreset } from "../presets";
import { docFromJson } from "./importDoc";
import { normalizeDoc } from "./migrate";
import { docDuration } from "@/app/components/motion-studio/engine/timing";
import { transformAt } from "@/app/components/motion-studio/engine/transform";
import { parseImport } from "../presets";

const scene = () => ({ ...welcomePreset(), version: 4, timeline: { tailSeconds: 0 }, clips: [{
  ...makeText({ name: "Moving illustration", x: 100, y: 200, start: 0 }), id: "drawing",
  motion: { blocks: [{ id: "lift", type: "transform", start: 0, duration: 8, from: { x: 0 }, to: { x: 80 } }] },
}] });

describe("editable motion document boundary", () => {
  it("imports, evaluates, saves and reopens a motion master without losing controls", () => {
    const result = docFromJson(JSON.stringify(scene()), "scene.json");
    if (!result.ok) throw new Error(result.message);
    expect(result.doc.version).toBe(4);
    expect(transformAt(result.doc, "drawing", 4).x).toBeCloseTo(140);
    expect(docDuration(result.doc)).toBe(8);
    expect(normalizeDoc(JSON.parse(JSON.stringify(result.doc))).doc).toEqual(result.doc);
  });
  it("refuses motion hidden in an older version instead of silently ignoring it", () => {
    expect(docFromJson(JSON.stringify({ ...scene(), version: 2 }), "bad.json").ok).toBe(false);
  });
  it("refuses unknown motion operators and invalid target references", () => {
    const doc = scene();
    doc.clips[0].motion.blocks[0].type = "execute-script";
    expect(docFromJson(JSON.stringify(doc), "bad.json").ok).toBe(false);
  });
  it("wraps portable motion layers in the new document contract", () => {
    const result = docFromJson(JSON.stringify(scene().clips[0]), "layer.json");
    expect(result.ok && result.doc.version).toBe(4);
  });
  it("keeps exact duration, loop and explicit tail after reopening", () => {
    const doc={...scene(),timeline:{duration:8,loop:true,tailSeconds:0}};
    const result=docFromJson(JSON.stringify(doc),"timed.json");
    if(!result.ok)throw new Error(result.message);
    expect(result.doc.timeline).toEqual(doc.timeline);
    expect(docDuration(result.doc)).toBe(8);
    expect(docFromJson(JSON.stringify({...doc,timeline:{...doc.timeline,duration:2}}),"cut.json").ok).toBe(false);
  });
  it("refuses malformed rig dependencies without crashing the importer", () => {
    const doc={...scene(),clips:[...scene().clips,{id:"broken",type:"rig",start:0,x:0,y:0}]};
    expect(()=>parseImport(doc)).not.toThrow();
    expect(parseImport(doc).kind).toBe("error");
  });
  it("does not silently cut ordinary property keys off an explicit timeline",()=>{
    const doc={...scene(),timeline:{tailSeconds:0,duration:8},clips:[{...scene().clips[0],keys:{x:[{time:0,value:0},{time:9,value:20}]}}]};
    expect(parseImport(doc).kind).toBe("error");
  });
});
