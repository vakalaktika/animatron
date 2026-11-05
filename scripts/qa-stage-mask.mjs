// Regression proof through the same StageCanvas + snapshotStage path as export.
// No uploads; the synthetic fixture includes no external images or private art.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
const repo = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "animatron-mask-qa-"));
const output = process.argv[2] ? resolve(process.argv[2]) : join(temporary, "proof");
mkdirSync(resolve(output, ".."), { recursive: true });
try {
  const template = JSON.parse(readFileSync(join(repo, "examples/tween-studio/lamp.animatron.json"), "utf8"));
  const rectangle = (left, right) => [{x:left,y:10},{x:right,y:10},{x:right,y:90},{x:left,y:90}];
  const stageMask = { regions: [rectangle(10,40),rectangle(60,90)] };
  const rig = {
    format:"mid-century-ink-rig",version:1,canvas:{width:100,height:100},
    svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="red"><path d="M0 0H100V100H0Z" fill="#ff0000"/></g></svg>',
    bones:[{id:"root",parentId:null,length:0,rest:{x:0,y:0,rotation:0}}],
    bindings:[{id:"red",svgId:"red",boneId:"root",bindMatrix:[1,0,0,1,0,0]}],
    animations:[{id:"still",duration:1,loop:false,tracks:[]}],
  };
  const clip = {...template.clips[0],id:"masked",x:50,y:50,stageMask,animationId:"still",rig,keys:{x:[{time:0,value:50,ease:{name:"linear"}},{time:1,value:60,ease:{name:"linear"}}]}};
  const doc = {...template,version:3,name:"Stationary aperture regression",stage:{width:100,height:100,background:"#0000ff",transparent:false},clips:[clip]};
  const input = join(temporary, "scene.json");
  writeFileSync(input,JSON.stringify(doc));
  const rendering = execFileSync(process.execPath,[join(repo,"scripts/preview-scene.mjs"),input,output,"--stills-only","--times=0,1"],{encoding:"utf8"});
  for (const moment of ["0.00","1.00"]) {
    const {data,info} = await sharp(`${output}.frame-${moment}.png`).raw().toBuffer({resolveWithObject:true});
    const pixel = (x,y) => Array.from(data.slice((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3));
    for (const [x,y] of [[20,20],[75,20]]) assert.deepEqual(pixel(x,y),[255,0,0],"pane reveals artwork");
    for (const [x,y] of [[45,20],[50,20],[5,20],[20,5]]) assert.deepEqual(pixel(x,y),[0,0,255],"fixed frame and outside stay hidden as the object moves");
  }
  const reopened = JSON.parse(readFileSync(`${output}.reopened.animatron.json`,"utf8"));
  assert.deepEqual(reopened.clips[0].stageMask,stageMask,"mask survives actual app import/save");
  console.log(JSON.stringify({renderer:JSON.parse(rendering.trim()).renderer,browser:JSON.parse(rendering.trim()).browser,visiblePanes:"PASS",stationaryFrameGap:"PASS",outsideHidden:"PASS",importSaveRoundTrip:"PASS",frames:2}));
} finally { rmSync(temporary,{recursive:true,force:true}); }
