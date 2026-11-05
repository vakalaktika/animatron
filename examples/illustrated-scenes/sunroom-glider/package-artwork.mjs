// Portable layered paint master, following the OpenRaster baseline format.
// Requires the reviewed app still and part inventory produced by build.mjs.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const root=import.meta.dirname;
for(const file of readdirSync(root).filter(name=>/^preview\.frame-.*\.png$/.test(name))) {
  const input=readFileSync(join(root,file));
  const output=await sharp(input).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
  assert.ok((await sharp(input).raw().toBuffer()).equals(await sharp(output).raw().toBuffer()),'PNG recompression must preserve every rendered pixel');
  if(output.length<input.length)writeFileSync(join(root,file),output);
}
await sharp(join(root,'preview.frame-0.00.png')).resize(256,256,{fit:'inside'}).png().toFile(join(root,'thumbnail.png'));
const code=`
import json, pathlib, sys, zipfile, xml.etree.ElementTree as ET
root=pathlib.Path(sys.argv[1])
inventory=json.loads((root/'part-inventory.json').read_text())
parts={p['id']:p for p in inventory['parts']}
image=ET.Element('image', {'version':'0.0.6','w':'1536','h':'1024','name':'Sunroom glider - layered paint master'})
stack=ET.SubElement(image,'stack')
order=['cuff-front','head-turn','head-mid','head-blink','head-open','lift','bird','plate']
hidden={'head-turn','head-mid','head-blink','bird'}
for name in order:
    p=parts[name]
    ET.SubElement(stack,'layer', {'name':name,'src':'data/'+name+'.png','x':str(p['x']),'y':str(p['y']),'opacity':'1.0','visibility':'hidden' if name in hidden else 'visible','composite-op':'svg:src-over'})
with zipfile.ZipFile(root/'sunroom-glider.ora','w',zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('mimetype',b'image/openraster',compress_type=zipfile.ZIP_STORED)
    archive.writestr('stack.xml',ET.tostring(image,encoding='utf-8',xml_declaration=True))
    for name in order: archive.write(root/parts[name]['file'],'data/'+name+'.png')
    archive.write(root/'preview.frame-0.00.png','mergedimage.png')
    archive.write(root/'thumbnail.png','Thumbnails/thumbnail.png')
with zipfile.ZipFile(root/'sunroom-glider.ora') as archive:
    assert archive.infolist()[0].filename=='mimetype'
    assert archive.infolist()[0].compress_type==zipfile.ZIP_STORED
    assert archive.read('mimetype')==b'image/openraster'
    parsed=ET.fromstring(archive.read('stack.xml'))
    assert len(parsed.find('stack').findall('layer'))==8
    assert archive.testzip() is None
print('OpenRaster: 8 registered paint layers, hidden alternate drawings, ZIP/XML/CRC checks PASS')
`;
console.log(execFileSync('python3',['-c',code,root],{encoding:'utf8'}).trim());
