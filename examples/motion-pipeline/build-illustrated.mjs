// Registration of inspected generated drawings, not automatic image separation.
// Pixel data is unchanged: only unsupported ancillary PNG metadata is omitted.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../../docs/mci-rig/mci-rig-core.cjs');
const dir=new URL('./illustrated/',import.meta.url);
const save=(name,data)=>fs.writeFileSync(new URL(name,dir),typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n');
function png(name,out){
 const b=fs.readFileSync(new URL(name,dir)),chunks=[b.subarray(0,8)];
 for(let p=8;p<b.length;){const n=b.readUInt32BE(p),end=p+n+12,kind=b.toString('ascii',p+4,p+8);if(['IHDR','PLTE','tRNS','IDAT','IEND'].includes(kind))chunks.push(b.subarray(p,end));p=end;}
 const result=Buffer.concat(chunks);save(out,result);return 'data:image/png;base64,'+result.toString('base64');
}
const atlas=png('parts.png','parts.png'),plate=png('background.png','background.png');
png('finished-key-pose.png','finished-key-pose.png');
const bone=(id,parentId,x,y)=>({id,parentId,role:id,rest:{x,y,rotation:0},length:0});
const bones=[bone('root',null,0,0),bone('body','root',828,744),bone('head','body',18,-201),bone('upper-arm','body',99,-190),bone('forearm','upper-arm',113,-105),bone('hand','forearm',101,-139)];
const makeRig=(name,canvas,parts,bones)=>{
 const r={format:'mid-century-ink-rig',version:4,name,canvas,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}">${parts.map(p=>`<g id="${p.id}"/>`).join('')}</svg>`,bones,bindings:[],rasterSources:[{id:'atlas',src:atlas}],rasterAttachments:parts.map(({boneId,...p})=>({...p,svgId:p.id,src:'@atlas'})),animations:[],metadata:{treatment:'detailed-storybook',identityStatus:'invented; provisional, not user-approved',partPreparation:'Generated separate drawings, manually registered and inspected. No automatic segmentation claim.'}};
 const w=core.world(r);r.bindings=parts.map(p=>({id:p.id,svgId:p.id,boneId:p.boneId,bindMatrix:core.inverse(w[p.boneId])}));return r;
};
const rect=(id,boneId,col,row,x,y,scale)=>({id,boneId,sourceRect:{x:Math.floor(col*443.5),y:row?443:0,width:col===3?444:443,height:row?444:443},x,y,width:443*scale,height:(row?444:443)*scale});
const family=makeRig('Detailed — Mira and the garden glider',{width:1672,height:941},[
 rect('upper-sleeve','upper-arm',1,0,868.5,389.75,.45),
 rect('torso','body',0,0,646.25,470.75,.85),
 rect('forearm-paint','forearm',2,0,941,225.9,.66),
 rect('hand-paint','hand',3,0,1090.18,198.79,.33),
 rect('head-open','head',0,1,573.3,230.7,.9),
 rect('head-turned','head',1,1,590.4,228,.9),
 rect('head-blink','head',2,1,613.8,230.7,.9),
],bones);
// Concealed shoulder paint bridges the independently generated sleeve and
// torso. Its curved overlap was inspected in the posed application frames.
family.svg=family.svg.replace('<g id="torso"/>','<g id="shoulder-underpaint"><path d="M884 543 Q907 531 929 544 Q944 557 943 578 Q929 592 908 586 L887 575 Z" fill="#e77964"/></g><g id="torso"/>');
family.bindings.push({id:'shoulder-underpaint',svgId:'shoulder-underpaint',boneId:'body',bindMatrix:core.inverse(core.world(family).body)});
const key=(time,rotation=0,x=0,y=0)=>({time,x,y,rotation,easing:'linear',tween:{name:'inOut'}});
family.slots=[{id:'plane-grip',boneId:'hand',x:50,y:-70,rotation:0}];
family.drawingSets=[{id:'head-angle',defaultDrawingId:'open',drawings:[{id:'open',svgIds:['head-open']},{id:'turned',svgIds:['head-turned']},{id:'blink',svgIds:['head-blink']}]}];
family.animations=[{id:'lift',duration:8,loop:true,tracks:[{boneId:'body',keys:[key(0),key(.6,1,0,3),key(2,-.8,2,-3),key(4.4,-.8,2,-3),key(6.5),key(8)]},{boneId:'head',keys:[key(0),key(1.8,-2),key(4.6,-2),key(6.5),key(8)]}],drawingTracks:[{setId:'head-angle',keys:[[0,'open'],[1.12,'blink'],[1.26,'open'],[2.8,'turned'],[5.2,'open'],[6.7,'blink'],[6.84,'open'],[8,'open']].map(([time,drawingId])=>({time,drawingId}))}]}];
const track=(values)=>values.map(([time,value])=>({time,value,ease:{name:'inOut'}}));
family.motion={controllers:[{id:'plane-hand',name:'Lift the paper airplane',space:'rig',x:1100,y:365,keys:{x:track([[0,1100],[.6,1090],[2,1130],[4.4,1130],[6.5,1100],[8,1100]]),y:track([[0,365],[.6,375],[2,325],[4.4,325],[6.5,365],[8,365]])}}],constraints:[{id:'hand-contact',type:'ik',name:'Arm follows the hand',rootId:'upper-arm',midId:'forearm',tipId:'hand',targetId:'plane-hand',bend:1,weight:1}]};
const root=[bone('root',null,0,0)];
const background={format:'mid-century-ink-rig',version:2,name:'Detailed — reconstructed garden room',canvas:{width:1672,height:941},svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1672 941"><g id="room"/></svg>',bones:root,bindings:[{id:'room',svgId:'room',boneId:'root',bindMatrix:[1,0,0,1,0,0]}],rasterAttachments:[{id:'room',svgId:'room',src:plate,x:0,y:0,width:1672,height:941}],animations:[]};
// A native vector prop avoids copying the character atlas into a second rig.
// Its grip and fold geometry are registered to the same illustrated hand.
const plane={format:'mid-century-ink-rig',version:1,name:'Detailed — editable folded airplane',canvas:{width:300,height:180},svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 180"><g id="plane"><path d="M116 52 L265 38 L132 130 L140 90 Z" fill="#fff5e9"/><path d="M116 52 L155 77 L265 38 L140 90 L132 130 L150 83 Z" fill="#c9ad98"/><path d="M116 52 L155 77 L265 38 L150 83 L132 130 L140 90 Z" fill="#fff5e9"/></g></svg>',bones:root,bindings:[{id:'plane',svgId:'plane',boneId:'root',bindMatrix:[1,0,0,1,0,0]}],animations:[]};
const scale=1280/1672;
const clip=(id,name,rig)=>({id,name,type:'rig',enabled:true,start:0,x:640,y:360,scale,parentId:null,followRotation:true,rig,animationId:rig.animations[0]?.id??null,pose:{}});
const bird=JSON.parse(fs.readFileSync(new URL('outside-bird.mci.json',import.meta.url),'utf8'));
const b={...clip('bird','Swallow beyond the glass',bird),x:500,y:122,scale:.42,stageMask:{regions:[[{x:500,y:5},{x:665,y:5},{x:665,y:292},{x:500,y:292}],[{x:687,y:5},{x:1255,y:5},{x:1255,y:292},{x:687,y:292}]]},motion:{blocks:[{id:'garden-pass',name:'Bird flies right',type:'path',start:0,duration:8,points:[{x:-240,y:20},{x:840,y:-20}],ease:{name:'linear'}}]}};
const doc={version:4,name:'Detailed — Mira and the garden glider',description:'Layered illustrated benchmark: prepared raster parts, persistent hand IK, registered perspective drawings and a socket-held plane. Mother and boy remain in the composed room plate.',timeline:{duration:8,loop:true,tailSeconds:0},stage:{width:1280,height:720,background:'#fff3df',transparent:false},clips:[clip('room','Reconstructed room — mother and boy still',background),b,clip('daughter','Daughter — body, arm and registered head drawings',family),{...clip('plane','Plane held at the grip',plane),x:0,y:0,motion:{constraints:[{id:'held-plane',name:'Plane follows the hand grip',type:'attach',targetClipId:'daughter',slotId:'plane-grip',offset:{x:0,y:0,rotation:0},followRotation:true}]}}],scenePlan:{version:1,actors:[{clipId:'room',action:'still'},{clipId:'daughter',action:'articulated',requiredParts:['body','upper-arm','forearm','hand','head']},{clipId:'plane',action:'rigid'}],travels:[{clipId:'bird',restFacing:'right',mode:'forward',space:'exterior'}]}};
save('daughter.mci.json',family);save('plane.mci.json',plane);save('room.mci.json',background);save('detailed-illustrated.animatron.json',doc);
save('registration.json',{canvas:{width:1672,height:941},parts:family.rasterAttachments,slots:family.slots,notes:'Atlas crops are registered source rectangles; all pixel data remains editable in the original parts PNG. Reinspect seams after any artwork change.'});
console.log('Built layered illustrated scene with shared PNG atlas, independent arm controls and preserved alpha.');
