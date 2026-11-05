import ts from "typescript";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../src/app/components/motion-studio/engine/rigV2.ts",import.meta.url),"utf8");
const generated = "// Generated from engine/rigV2.ts; regenerate with scripts/sync-rig-v2.mjs.\n" + "(function(host,factory){ const api=factory(); if(typeof module!==\"undefined\" && module.exports) module.exports=api; else host.MCIRigV2=api; })(typeof globalThis!==\"undefined\"?globalThis:this,function(){ const exports={};\n" + ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText + "\nreturn exports; });\n";
const target = new URL("../docs/mci-rig/mci-rig-v2.cjs",import.meta.url);
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target,"utf8") !== generated) throw new Error("Rig 2 shared runtime is stale; run node scripts/sync-rig-v2.mjs");
} else fs.writeFileSync(target,generated);

// Keep native Rig 3 timing identical in the dependency-free plugin runtime.
const easingSource=fs.readFileSync(new URL('../src/app/components/motion-studio/engine/easing.ts',import.meta.url),'utf8');
const easingGenerated='// Generated from engine/easing.ts; regenerate with scripts/sync-rig-v2.mjs.\n'+
 '(function(host,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else host.MCIEasing=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){const exports={};\n'+
 ts.transpileModule(easingSource,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText+'\nreturn exports;});\n';
const easingTarget=new URL('../docs/mci-rig/mci-easing.cjs',import.meta.url);
if(process.argv.includes('--check')){
 if(fs.readFileSync(easingTarget,'utf8')!==easingGenerated)throw new Error('Shared easing runtime is stale; run node scripts/sync-rig-v2.mjs');
}else fs.writeFileSync(easingTarget,easingGenerated);
