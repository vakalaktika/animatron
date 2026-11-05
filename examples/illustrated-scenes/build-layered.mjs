import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Explicitly created separated parts from our authored vector master, not a
// claimed automatic separation of a flattened illustration. Retain the source.
const folder=join(dirname(fileURLToPath(import.meta.url)),'garden-glider');
const rig=JSON.parse(readFileSync(join(folder,'garden-glider.mci.json'),'utf8'));
const attachments=[];
let svg=rig.svg;
for (const part of [
  {id:'room',x:0,y:0,width:1280,height:800},
  {id:'lift',x:620,y:308,width:132,height:183},
]) {
  const match=rig.svg.match(new RegExp(`<g id="${part.id}">([\\s\\S]*?)</g>`));
  if(!match)throw new Error('Missing source group '+part.id);
  const source=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${part.x} ${part.y} ${part.width} ${part.height}" width="${part.width*2}" height="${part.height*2}">${match[1]}</svg>`;
  const encoded=await sharp(Buffer.from(source)).png().toBuffer();
  // Sharp supplies pHYs metadata by default; Rig 2 intentionally accepts only
  // pixel-bearing PNG chunks. Preserve their original bytes and CRCs.
  const chunks=[encoded.subarray(0,8)];
  for(let pos=8;pos<encoded.length;) {
    const size=encoded.readUInt32BE(pos)+12,kind=encoded.toString('ascii',pos+4,pos+8);
    if(['IHDR','PLTE','tRNS','IDAT','IEND'].includes(kind))chunks.push(encoded.subarray(pos,pos+size));
    pos+=size;
  }
  const png=Buffer.concat(chunks);
  writeFileSync(join(folder,`${part.id}-2x.png`),png);
  attachments.push({...part,svgId:part.id,id:`raster-${part.id}`,src:`data:image/png;base64,${png.toString('base64')}`});
  svg=svg.replace(match[0],`<g id="${part.id}"></g>`);
}
const layered={...rig,name:'Garden glider — layered illustrated edition',svg,rasterAttachments:attachments,metadata:{...rig.metadata,artworkPath:'layered-illustrated',separation:'Two parts explicitly authored from semantic SVG groups at 2x. No automatic separation asserted. Source curves retained in vector master.',seamReview:'Transparent hand-plane perimeter created together; hidden forearm area is complete and overlaps stationary sleeve. PNG background is opaque. All other characters remain native vectors.'}};
writeFileSync(join(folder,'garden-glider-layered.mci.json'),JSON.stringify(layered,null,2)+'\n');
const doc=JSON.parse(readFileSync(join(folder,'garden-glider.animatron.json'),'utf8'));
writeFileSync(join(folder,'garden-glider-layered.animatron.json'),JSON.stringify({...doc,name:layered.name,clips:[{...doc.clips[0],rig:layered}]},null,2)+'\n');
console.log('Wrote explicit 2x room and transparent hand/plane attachments, layered rig and composition.');
