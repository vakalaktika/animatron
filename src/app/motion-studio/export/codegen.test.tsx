// @vitest-environment jsdom
import { render } from "@testing-library/react";
import ts from "typescript";
import { motionValue } from "motion/react";
import { ClipView } from "@/app/components/motion-studio/clips/ClipView";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import { clipComponentCode, clipExportDocument, docComponentCode } from "./codegen";
import { makeText } from "../presets";
import type { StudioDoc } from "@/app/components/motion-studio/types";

test("single-layer developer export retains stage-space clipping",()=>{
 const clip={...makeText({id:"bird",name:"Bird",text:"Bird",start:0}),stageMask:{regions:[[{x:0,y:0},{x:100,y:0},{x:100,y:100}]]}};
 const doc:StudioDoc={version:3,name:"Window",stage:{width:100,height:100,background:"#fff",transparent:false},clips:[clip]};
 const generated=ts.transpileModule(clipComponentCode(doc,clip),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{} as {Bird:React.ComponentType}};
 const requireRuntime=(name:string)=>name==="@/app/components/motion-studio"?{StageCanvas,ClipView,clipDuration:()=>1,useStudioClock:()=>({time:motionValue(0)})}:require(name);
 new Function("require","module","exports",generated)(requireRuntime,mod,mod.exports);
 const Component=mod.exports.Bird;
 const view=render(<Component/>);
 expect(view.container.querySelector('[data-stage-mask="bird"]')).not.toBeNull();
});

test("motion exports retain animated dependency closure and original timing",()=>{
 const target={...makeText({id:"target",name:"Hidden carrier",start:1}),enabled:false,motion:{blocks:[{id:"travel",type:"transform" as const,start:0,duration:4,from:{x:0},to:{x:100}}]}};
 const clip={...makeText({id:"held",name:"Held prop",start:2}),motion:{constraints:[{id:"grip",type:"attach" as const,targetClipId:"target",offset:{x:0,y:0,rotation:0}}]}};
 const doc:StudioDoc={version:4,name:"Contacts",stage:{width:100,height:100,background:"#fff",transparent:false},clips:[target,clip]};
 const code=clipComponentCode(doc,clip);
 expect(code).toContain('"id": "target"');
 expect(code).toContain('"start": 2');
 expect(code).toContain('"enabled": false');
 expect(docComponentCode(doc)).toContain('"id": "target"');
});

test("a self-contained layer export retains hidden parents and only its relevant review declarations",()=>{
 const parent={...makeText({id:"parent",start:0}),enabled:false},child={...makeText({id:"child",start:0}),parentId:"parent"};
 const doc:StudioDoc={version:3,name:"Layers",stage:{width:100,height:100,background:"#fff",transparent:false},clips:[parent,child],scenePlan:{version:1,actors:[{clipId:"child",action:"rigid"},{clipId:"elsewhere",action:"still"}],travels:[]}};
 const slice=clipExportDocument(doc,child);
 expect(slice.scenePlan?.actors.map(a=>a.clipId)).toEqual(["child"]);
 expect(clipComponentCode(doc,child)).toContain('"enabled": false');
});
