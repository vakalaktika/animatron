// Build editable source fixtures, then apply motion.spec.json with Composer tween.mjs.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../../docs/mci-rig/mci-rig-core.cjs");
const template = JSON.parse(fs.readFileSync(new URL("../illustrated-scenes/sunroom-glider/sunroom-glider.animatron.json", import.meta.url)));
const out = new URL("./", import.meta.url);
const save = (name, value) => fs.writeFileSync(new URL(name, out), JSON.stringify(value, null, 2) + "\n");
const bones = [
  { id: "root", parentId: null, rest: { x: 0, y: 0, rotation: 0 }, length: 0 },
  { id: "lower", name: "Lower arm", parentId: "root", rest: { x: 340, y: 490, rotation: -105 }, length: 165 },
  { id: "upper", name: "Upper arm", parentId: "lower", rest: { x: 165, y: 0, rotation: 70 }, length: 185 },
  { id: "shade", name: "Lamp shade", parentId: "upper", rest: { x: 185, y: 0, rotation: 35 }, length: 0 }
];
const rig = { format: "mid-century-ink-rig", version: 1, name: "Articulated desk lamp", canvas: { width: 800, height: 600 }, bones, bindings: [], animations: [{ id: "lamp", name: "A considered nod", duration: 6, loop: true, tracks: [] }] };
const world = core.world(rig);
const joint = id => core.point(world[id], { x: 0, y: 0 });
const a = joint("lower"), b = joint("upper"), c = joint("shade");
const line = (p, q) => `M${p.x},${p.y} L${q.x},${q.y}`;
rig.svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<g id="root"><path d="M80 510 H720 V523 H80Z" fill="#bf7756"/><path d="M300 490 Q340 471 380 490 L400 505 H280Z" fill="#243f46"/>
<path d="M590 483 L686 483 L705 501 L580 501Z" fill="#e5bf66"/><path d="M590 476 L678 476 L686 483 L590 483Z" fill="#f5ebd4"/><path d="M602 472 L690 472" stroke="#466569" stroke-width="5"/></g>
<g id="lower"><path d="${line(a,b)}" stroke="#31585c" stroke-width="23" stroke-linecap="round"/><path d="${line({x:a.x-5,y:a.y},{x:b.x-5,y:b.y})}" stroke="#7b9990" stroke-width="4"/><circle cx="${a.x}" cy="${a.y}" r="15" fill="#243f46"/></g>
<g id="upper"><path d="${line(b,c)}" stroke="#31585c" stroke-width="20" stroke-linecap="round"/><circle cx="${b.x}" cy="${b.y}" r="18" fill="#c36b4c"/><circle cx="${b.x}" cy="${b.y}" r="7" fill="#f1d393"/></g>
<g id="shade"><circle cx="${c.x}" cy="${c.y}" r="13" fill="#243f46"/><path d="M${c.x-22} ${c.y-8} Q${c.x+35} ${c.y-50} ${c.x+84} ${c.y+5} L${c.x+109} ${c.y+47} Q${c.x+40} ${c.y+73} ${c.x-35} ${c.y+47}Z" fill="#d27450"/><path d="M${c.x-35} ${c.y+47} Q${c.x+40} ${c.y+73} ${c.x+109} ${c.y+47} Q${c.x+30} ${c.y+30} ${c.x-35} ${c.y+47}Z" fill="#f3d38b"/></g></svg>`;
rig.bindings = bones.map(bone => ({ id: bone.id, svgId: bone.id, boneId: bone.id, bindMatrix: core.inverse(world[bone.id]) }));
const clip = { ...template.clips[1], id: "lamp", name: "Desk lamp — select a part", rig, animationId: "lamp", pose: {}, x: 470, y: 355, scale: 1, start: 0 };
const paperRig = { format: "mid-century-ink-rig", version: 1, name: "Paper swatch", canvas: { width: 180, height: 120 }, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 120"><g id="paper"><path d="M5 15 L160 5 L172 104 L15 115Z" fill="#fff6db"/><path d="M35 38 L130 31 M37 54 L115 48 M40 70 L135 63" stroke="#bc7756" stroke-width="3"/></g></svg>', bones: [{ id:"root",parentId:null,rest:{x:0,y:0,rotation:0},length:0 }], bindings: [{id:"paper",svgId:"paper",boneId:"root",bindMatrix:[1,0,0,1,0,0]}], animations:[{id:"still",duration:6,loop:true,tracks:[]}] };
const paper = { ...clip, id: "paper", name: "Paper — independent object tween", rig: paperRig, animationId:"still", x:650,y:580,scale:0.7 };
const doc = { version: 2, name: "Tween Studio — a considered nod", description:"Sparse editable articulated motion; a technical fixture, not a new style authority.", stage: { width:1000,height:720,background:"#f2e6cd",transparent:false }, timeline:{tailSeconds:0}, clips:[clip,paper] };
save("lamp.base.animatron.json",doc);
save("lamp.source.mci.json",rig);
const keys = values => values.map(([time,rotation]) => ({time,rotation,ease:"inOut"}));
save("lamp.motion.json", { version:1,duration:6,loop:true,targets:[
 {clipId:"lamp",animationId:"lamp",bones:{lower:keys([[0,0],[1.5,12],[3,12],[4.5,0],[6,0]]),upper:keys([[0,0],[1.5,-24],[3,-24],[4.5,0],[6,0]]),shade:keys([[0,0],[1.7,12],[3,12],[4.7,0],[6,0]])}},
 {clipId:"paper",properties:{rotation:[{time:0,value:-4,ease:"inOut"},{time:1.8,value:3,ease:"inOut"},{time:3,value:3,ease:"inOut"},{time:4.8,value:-4,ease:"inOut"},{time:6,value:-4,ease:"inOut"}]}}
]});
// Keep generated artwork untouched; replace only the sampled rigid carriers.
save("sunroom.motion.json", {version:1,duration:8,loop:true,targets:[
 {clipId:"scene",animationId:"sunroom-loop",bones:{lift:keys([[0,0],[0.6,0],[0.9,0.6],[2.2,-4],[4.6,-4],[5.7,0.3],[6.4,0],[8,0]])}},
 {clipId:"outside-bird",animationId:"bird-pass",bones:{bird:[{time:0,x:150,y:0,rotation:0,ease:"linear"},{time:0.6,x:150,y:0,rotation:0,ease:"linear"},{time:5.6,x:-270,y:-35,rotation:-3,ease:"linear"},{time:6,x:-300,y:-35,rotation:-3,ease:"linear"},{time:6.01,x:150,y:0,rotation:0,ease:"linear"},{time:8,x:150,y:0,rotation:0,ease:"linear"}]}}
]});
console.log("Source fixtures and sparse motion specifications built.");
