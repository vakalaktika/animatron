// @vitest-environment jsdom
import { render } from "@testing-library/react";
import ts from "typescript";
import { motionValue } from "motion/react";
import { ClipView } from "@/app/components/motion-studio/clips/ClipView";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import { clipComponentCode } from "./codegen";
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
