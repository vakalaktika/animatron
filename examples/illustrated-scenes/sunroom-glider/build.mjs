// Prepare reviewed generated artwork; no illustration is replaced by code geometry.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const core = require('../../../docs/mci-rig/mci-rig-core.cjs');
const out = import.meta.dirname, W = 1536, H = 1024;
mkdirSync(join(out, 'parts'), { recursive: true });
const write = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2)+'\n');
const definitions = [
  {id:'plate', source:'clean-plate.png', x:0,y:0,width:W,height:H, alpha:false, bone:'root', inferred:'Sky, garden and wall concealed by removed head/arm/bird.'},
  {id:'lift', source:'extracted-parts.png', crop:{left:790,top:340,width:264,height:400},x:820,y:340,width:264,height:400,alpha:true,bone:'lift',inferred:'Rounded lower forearm extends inside stationary cuff.'},
  {id:'head-open',source:'head-open.png',x:1094,y:320,width:480,height:512,alpha:true,bone:'head',inferred:'Neck and collar edge repainted in extraction.'},
  {id:'head-blink',source:'head-blink.png',x:1094,y:320,width:480,height:512,alpha:true,bone:'head',inferred:'Closed eyelids; replacement generated from open head.'},
  {id:'head-mid',source:'head-mid.png',x:1094,y:320,width:480,height:512,alpha:true,bone:'head',inferred:'Intermediate perspective head drawing; concealed far-side face/hair inferred.'},
  {id:'head-turn',source:'head-turn.png',x:1094,y:320,width:480,height:512,alpha:true,bone:'head',inferred:'More frontal perspective head drawing; concealed face/hair inferred.'},
  {id:'cuff-front',source:'cuff-front.png',crop:{left:840,top:656,width:128,height:108},x:875,y:656,width:128,height:108,alpha:true,bone:'root',inferred:'Generated isolated foreground cuff follows curved skin boundary; manually registered +35px.'},
  {id:'bird',source:'extracted-parts.png',crop:{left:810,top:110,width:140,height:120},x:840,y:110,width:140,height:120,alpha:true,bone:'bird',inferred:'Extracted bird; no automatic wing deformation.'},
];

// Keep original PNG bytes/alpha masters. Playback uses high-quality resampling
// where noted and lossless PNG compression; metadata stripping retains CRCs.
function stripMetadata(encoded) {
  const chunks=[encoded.subarray(0,8)];
  for(let pos=8;pos<encoded.length;) {
    const size=encoded.readUInt32BE(pos)+12, kind=encoded.toString('ascii',pos+4,pos+8);
    if(['IHDR','PLTE','tRNS','IDAT','IEND'].includes(kind)) chunks.push(encoded.subarray(pos,pos+size));
    pos+=size;
  }
  return Buffer.concat(chunks);
}

const parts=[];
for(const d of definitions) {
  let pipeline=sharp(join(out,'source',d.source));
  if(d.crop) pipeline=pipeline.extract(d.crop);
  pipeline=pipeline.resize(d.pixels??d.width, d.pixels?Math.round(d.pixels*d.height/d.width):d.height, {fit:'fill'});
  // Generated transparent PNGs may carry elaborate RGB in fully invisible
  // pixels. Clear only alpha=0 RGB; visible and partial-alpha pixels stay intact.
  if(d.alpha) {
    const {data,info}=await pipeline.ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let i=0;i<data.length;i+=info.channels)if(data[i+3]===0)data.fill(0,i,i+3);
    pipeline=sharp(data,{raw:{width:info.width,height:info.height,channels:info.channels}});
  }
  const png=stripMetadata(await pipeline.png({compressionLevel:9,adaptiveFiltering:true}).toBuffer());
  const file=`parts/${d.id}.png`;
  writeFileSync(join(out,file),png);
  const metadata=await sharp(png).metadata();
  let alphaStats;
  if(d.alpha) {
    const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    alphaStats={transparent:0,visible:0,partial:0};
    for(let i=3;i<data.length;i+=info.channels) {
      if(data[i]===0) alphaStats.transparent++;
      else {alphaStats.visible++;if(data[i]<255)alphaStats.partial++;}
    }
  }
  parts.push({...d,file,pixelWidth:metadata.width,pixelHeight:metadata.height,bytes:png.length,alphaStats});
}

const bones=[
  {id:'root',parentId:null,rest:{x:0,y:0,rotation:0},length:0},
  {id:'lift',parentId:'root',rest:{x:929,y:695,rotation:0},length:0},
  {id:'head',parentId:'root',rest:{x:1210,y:730,rotation:0},length:0},
];
const attachment = p => ({id:`paint-${p.id}`,svgId:p.id,src:`data:image/png;base64,${readFileSync(join(out,p.file)).toString('base64')}`,x:p.x,y:p.y,width:p.width,height:p.height});
const bindings = (list, skeleton) => list.map(p=>{
  const b=skeleton.find(b=>b.id===p.bone);
  return {id:`bind-${p.id}`,svgId:p.id,boneId:p.bone,bindMatrix:[1,0,0,1,-b.rest.x,-b.rest.y]};
});
const svg = list => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${list.map(p=>`<g id="${p.id}"></g>`).join('')}</svg>`;
const smooth = t => (1-Math.cos(Math.PI*Math.max(0,Math.min(1,t))))/2;
function liftAt(t) {
  if(t<1.6)return 0;
  if(t<2)return .6*smooth((t-1.6)/.4);
  if(t<3)return .6-4.6*smooth(t-2);
  if(t<4.6)return -4;
  if(t<5.8)return -4+4*smooth((t-4.6)/1.2);
  return 0;
}
const track = (boneId, fn) => ({boneId,keys:Array.from({length:193},(_,i)=>({time:i/24,x:0,y:0,rotation:0,...fn(i/24),easing:'linear'}))});
const main=parts.filter(p=>p.id!=='bird' && p.id!=='plate');
const rig={format:'mid-century-ink-rig',version:2,name:'Sunroom glider — illustrated family',canvas:{width:W,height:H},svg:svg(main),bones,bindings:bindings(main,bones),rasterAttachments:main.map(attachment),drawingSets:[{id:'head-view',defaultDrawingId:'open',drawings:['open','blink','mid','turn'].map(id=>({id,svgIds:[`head-${id}`]}))}],animations:[{id:'sunroom-loop',name:'A small moment of pride',duration:8,loop:true,tracks:[track('lift',t=>({rotation:liftAt(t)}))],drawingTracks:[{setId:'head-view',keys:[{time:0,drawingId:'open'},{time:1.0833333333,drawingId:'blink'},{time:1.2083333333,drawingId:'open'},{time:2.75,drawingId:'mid'},{time:2.9166666667,drawingId:'turn'},{time:4.75,drawingId:'mid'},{time:4.9166666667,drawingId:'open'}]}]}],metadata:{treatment:'detailed-storybook',artworkPath:'generated-layered-illustration',identityStatus:'Invented provisional family; not saved or approved identities.',motionProfile:{kind:'restrained-seated-performance',deformation:'Rigid affine parts and registered perspective drawings; no mesh bending.'},contact:{hand:{x:909,y:422},plane:{x:914,y:416}},production:'Built-in image generation with primary Detailed style anchor and selected adult crops; supervised registration and clean-plate review. See source/prompts.md and part-inventory.json.',editability:'Separate PNG parts, bone posing, drawing replacement and timing; internal painted strokes are not editable vector paths.'}};
const birdParts=parts.filter(p=>p.id==='bird');
const birdBones=[{id:'root',parentId:null,rest:{x:0,y:0,rotation:0},length:0},{id:'bird',parentId:'root',rest:{x:910,y:170,rotation:0},length:0}];
const birdRig={format:'mid-century-ink-rig',version:2,name:'Sunroom bird — illustrated part',canvas:{width:W,height:H},svg:svg(birdParts),bones:birdBones,bindings:bindings(birdParts,birdBones),rasterAttachments:birdParts.map(attachment),animations:[{id:'bird-pass',name:'Quiet outside pass',duration:8,loop:true,tracks:[track('bird',t=>({x:t<=6?-70+400*smooth(t/6):330-400*smooth((t-6)/2),y:12*Math.sin(Math.PI*Math.min(t,6)/6),rotation:-2*Math.sin(Math.PI*Math.min(t,6)/6)}))]}]};
const plateParts=parts.filter(p=>p.id==='plate');
const plateRig={format:'mid-century-ink-rig',version:2,name:'Sunroom — full-resolution plate',canvas:{width:W,height:H},svg:svg(plateParts),bones:[bones[0]],bindings:bindings(plateParts,bones),rasterAttachments:plateParts.map(attachment),animations:[{id:'still',name:'Static room and seated family',duration:8,loop:true,tracks:[]}]};
for(const asset of [rig,birdRig,plateRig]) {
  const result=core.validate(asset);
  if(!result.ok)throw new Error(JSON.stringify(result.errors));
}
const base={enabled:true,start:0,x:W/2,y:H/2,scale:1,parentId:null,followRotation:false};
const doc={version:2,name:'Sunroom glider — generated illustration',description:'Invented Detailed family; an eight-second restrained layered illustration. Editable parts and timing, no editable internal vector strokes.',stage:{width:W,height:H,background:'#f7ead6',transparent:false},timeline:{tailSeconds:0},clips:[{...base,id:'scene',type:'rig',name:rig.name,rig,animationId:'sunroom-loop',pose:{}},{...base,id:'outside-bird',type:'rig',name:birdRig.name,rig:birdRig,animationId:'bird-pass',pose:{},keys:{opacity:[{time:0,value:0},{time:.6,value:0},{time:1.1,value:1},{time:5.5,value:1},{time:6,value:0},{time:8,value:0}]}}]};
doc.clips[1].keys.opacity=doc.clips[1].keys.opacity.map(key=>({...key,ease:{name:'inOut'}}));
// Existing clip layering keeps the full-resolution room in its own asset
// under the moving parts. Every rig and the whole JSON retain existing budgets.
doc.clips=[{...base,id:'room',type:'rig',name:plateRig.name,rig:plateRig,animationId:'still',pose:{}},...doc.clips];
if(Buffer.byteLength(JSON.stringify(doc))>=4_000_000)throw new Error('Composition exceeds importer budget.');
write('sunroom-glider.mci.json',rig);
write('bird.mci.json',birdRig);
write('room.mci.json',plateRig);
write('sunroom-glider.animatron.json',doc);
writeFileSync(join(out,'sunroom-glider.playback.animatron.json'),JSON.stringify(doc));
write('part-inventory.json',{canvas:{width:W,height:H},registration:'Extraction shifted left; arm and bird translated +30px, head +38px, cuff +35px. Generated head edits resampled to common 480x512 frame. Full-resolution room uses a separate static rig clip. See visual review for remaining differences.',parts});
console.log(JSON.stringify({parts:parts.length,mainPayload:main.reduce((n,p)=>n+p.bytes,0),compositionBytes:Buffer.byteLength(JSON.stringify(doc)),duration:8}));
