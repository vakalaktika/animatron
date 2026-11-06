"""Rebuild the small authored cloth texture and its fixed-topology Rig 4 fixture.

This is a technical deformation fixture, not an illustration-style benchmark.
No external images, fonts, network assets, or dependencies beyond Pillow.
"""
from pathlib import Path
import base64
import json
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
HERE.mkdir(exist_ok=True)
SCALE = 3
image = Image.new("RGBA", (300 * SCALE, 100 * SCALE))
draw = ImageDraw.Draw(image)

def point(p):
    return tuple(round(v * SCALE) for v in p)

def polygon(points, fill):
    draw.polygon([point(p) for p in points], fill=fill)

def bezier(a, b, c, d, steps=30):
    return [((1-t)**3*a[0]+3*(1-t)**2*t*b[0]+3*(1-t)*t*t*c[0]+t**3*d[0],
             (1-t)**3*a[1]+3*(1-t)**2*t*b[1]+3*(1-t)*t*t*c[1]+t**3*d[1]) for t in [i/steps for i in range(steps+1)]]

outline = [(8, 14), (265, 23)] + bezier((265,23),(283,24),(290,35),(290,50)) + bezier((290,50),(291,66),(281,79),(264,79)) + [(8, 87)]
polygon(outline, "#497b8b")
polygon([(8,14),(265,23),(265,37),(8,29)], "#6798a3")
polygon([(8,73),(265,64),(280,68),(264,79),(8,87)], "#355a69")
polygon([(245,23),(265,23),(272,26),(273,76),(264,79),(245,80)], "#d7c5a0")
draw.line([point((239,25)),point((239,77))],fill="#2e5262",width=2*SCALE)
for yy in (36,64):
    draw.ellipse([point((253,yy-3)),point((259,yy+3))],fill="#aa6d4d")
image.save(HERE / "cloth.png", optimize=True)
(HERE / "cloth.svg").write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">
<path fill="#497b8b" d="M8 14L265 23C283 24 290 35 290 50C291 66 281 79 264 79L8 87Z"/>
<path fill="#6798a3" d="M8 14L265 23L265 37L8 29Z"/>
<path fill="#355a69" d="M8 73L265 64L280 68L264 79L8 87Z"/>
<path fill="#d7c5a0" d="M245 23L265 23L272 26L273 76L264 79L245 80Z"/>
<path fill="none" stroke="#2e5262" stroke-width="2" d="M239 25L239 77"/>
<circle cx="256" cy="36" r="3" fill="#aa6d4d"/><circle cx="256" cy="64" r="3" fill="#aa6d4d"/>
</svg>''')

cols = [40,100,160,190,220,280,340]
rows = [80,105,130,155,180]
vertices = []
for yy in rows:
    for xx in cols:
        amount = min(1,max(0,(xx-145)/90))
        weights = []
        if amount < 1: weights.append({"boneId":"upper","weight":1-amount})
        if amount > 0: weights.append({"boneId":"forearm","weight":amount})
        vertices.append({"x":xx,"y":yy,"weights":weights})
triangles = []
for row in range(len(rows)-1):
    for col in range(len(cols)-1):
        a = row*len(cols)+col
        triangles += [[a,a+1,a+len(cols)],[a+1,a+len(cols)+1,a+len(cols)]]

asset = {
    "format":"mid-century-ink-rig","version":4,"name":"Editable cloth bend proof",
    "canvas":{"width":400,"height":320},
    "svg":'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320"><title>Fixed-topology painted cloth bend fixture</title><g id="cloth"/></svg>',
    "bones":[
        {"id":"root","parentId":None,"rest":{"x":0,"y":0,"rotation":0},"length":0},
        {"id":"upper","parentId":"root","role":"arm.right.upper","rest":{"x":40,"y":130,"rotation":0},"length":150},
        {"id":"forearm","parentId":"upper","role":"arm.right.forearm","rest":{"x":150,"y":0,"rotation":0},"length":150,"limits":{"min":-30,"max":75}},
    ],
    "bindings":[{"id":"cloth-binding","svgId":"cloth","boneId":"root","bindMatrix":[1,0,0,1,0,0]}],
    "rasterAttachments":[{"id":"cloth-paint","svgId":"cloth","src":"data:image/png;base64,"+base64.b64encode((HERE/"cloth.png").read_bytes()).decode(),"x":40,"y":80,"width":300,"height":100}],
    "meshes":[{"id":"cloth-mesh","rasterId":"cloth-paint","vertices":vertices,"triangles":triangles}],
    "animations":[{"id":"bend","name":"Cloth bends and returns","duration":4,"loop":True,"tracks":[{"boneId":"forearm","keys":[{"time":t,"x":0,"y":0,"rotation":r,"easing":"linear","tween":{"name":"inOut"}} for t,r in [(0,0),(1.2,58),(2.2,58),(3.4,0),(4,0)]]}]}],
    "metadata":{"purpose":"Technical raster deformation fixture; not an approved character or style anchor","source":"cloth.svg and build.py","mesh":"35 weighted vertices, 48 fixed triangles; two bone influences; alpha PNG"},
}
(HERE / "cloth.mci.json").write_text(json.dumps(asset,indent=2)+"\n")
doc = {"version":4,"name":"Cloth deformation proof","description":"A fixed-topology painted attachment bends under two bone influences; editable Rig 4 master.","stage":{"width":800,"height":480,"background":"#f4eddf","transparent":False},"timeline":{"tailSeconds":0},"clips":[{"id":"cloth-rig","type":"rig","name":"Painted cloth","enabled":True,"start":0,"x":400,"y":240,"scale":1.3,"parentId":None,"followRotation":False,"rig":asset,"animationId":"bend","pose":{}}]}
(HERE / "cloth.animatron.json").write_text(json.dumps(doc,indent=2)+"\n")
print("Wrote transparent cloth source, PNG, Rig 4, and Document 4 fixture")
