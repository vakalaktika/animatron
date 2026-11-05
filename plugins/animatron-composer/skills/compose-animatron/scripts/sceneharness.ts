import {readFileSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {join} from "node:path";
import {docFromJson} from "@/app/motion-studio/lib/importDoc";
import {reviewScene} from "@/app/components/motion-studio/engine/sceneReview";
const {JSDOM}=createRequire(join(process.cwd(),"package.json"))("jsdom");
(globalThis as {DOMParser?:unknown}).DOMParser=new JSDOM("").window.DOMParser;
try{
 const [file,planFile]=process.argv.slice(2);
 const parsed=docFromJson(readFileSync(file,"utf8"),file);
 if(!parsed.ok)throw new Error(parsed.message);
 if(parsed.warnings.length)throw new Error(parsed.warnings.join(" "));
 const result=reviewScene(parsed.doc,planFile?JSON.parse(readFileSync(planFile,"utf8")):parsed.doc.scenePlan);
 writeFileSync(1,`RESULT ${JSON.stringify(result)}\n`);process.exitCode=result.ok?0:1;
}catch(e){writeFileSync(1,`RESULT ${JSON.stringify({ok:false,issues:[{code:"import",message:(e as Error).message}]})}\n`);process.exitCode=1;}
