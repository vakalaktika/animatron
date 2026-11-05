# Sparse editable tweening

Use `scripts/tween.mjs` to add or replace selected tracks in a valid composition.
Create artwork once, identify independently moving parts, and author only the
important poses. The application evaluates all intervening times. Never generate
one image or JSON key per output frame for an ordinary eased move.

```sh
node scripts/tween.mjs scene.animatron.json motion.json --out scene-tweened.animatron.json --repo /path/to/animatron --offline
```

The selected application source must support Rig 3 for native bone curves.
Object property tweening already works in earlier versions. The command uses the
actual source importer and refuses repaired inputs, unsupported curves, or a
duration mismatch before writing the output atomically. A local checkout test
does not establish that the deployed studio supports the extension.

```json
{
  "version": 1,
  "duration": 8,
  "loop": true,
  "targets": [
    {
      "clipId": "character",
      "animationId": "performance",
      "bones": {
        "arm.left.forearm": [
          { "time": 0, "rotation": 0, "ease": "inOut" },
          { "time": 2, "rotation": -25, "ease": "hold" },
          { "time": 5, "rotation": -25, "ease": "smoothOut" },
          { "time": 8, "rotation": 0 }
        ]
      }
    },
    {
      "clipId": "bird",
      "properties": {
        "x": [
          { "time": 0, "value": 350, "ease": "inOut" },
          { "time": 4, "value": 900, "ease": "inOut" },
          { "time": 8, "value": 350 }
        ]
      }
    }
  ]
}
```

Target clips use stable IDs. Bone references resolve IDs first, then unique
roles. Times are seconds **from each layer's start**, not absolute composition
time. Every replacement track starts at zero, with strictly increasing times.
Bone values are deltas from the drawn rest pose; missing x/y/rotation components
mean zero. Each track is independent. A missing bone track is preserved, rather
than being reset every time another part changes.

Object properties: `x`, `y`, uniform `scale`, `rotation`, `opacity`. Ribbon geometry
supports only its existing x/y/opacity placement controls. Easing belongs to the
**outgoing** key: `inOut`, `smoothOut`, `flight`, `backOut`, `anticipate`, `snap`,
`linear`, or `{"name":"custom","custom":[x1,y1,x2,y2]}`. Custom x controls must be
0..1 and y controls -10..10. Bone `hold` is a discrete state, never blended.
Curved bone keys use Rig 3's optional `tween` field; existing linear/hold keys remain
valid. Object tracks use the existing `ease` field. Object properties hold after
their last key; `loop` applies to the edited bone animation and whole-composition
presentation, rather than silently changing each object's native playback.

The command replaces only the addressed property/bone tracks, preserving rest
joints, bindings, raster parts, drawing sets, metadata, other animation tracks and
other layers. It sets the timeline tail to zero for the explicitly requested
length and checks the application's evaluated duration. It refuses shortening
past preserved keys. Supply matching first/last states for a loop, and inspect
velocity as well as visual continuity; `loop:true` is not proof of a clean seam.

Separate upper arm, forearm, hand, prop, head, eyes, hair and other needed parts
before authoring motion. Parent a held prop to the hand/shared carrier to preserve
contact. Keep perspective changes as registered replacement drawings. A whole
illustration on one bone still behaves as one rigid picture; tweening does not
create missing anatomy, hidden paint, mesh deformation, or automatic lip sync.

Deliver the sparse editable composition/master, a same-renderer preview and a
reduced-motion still. Retain baked copies only for legacy playback, constraints
that actually need sampling, or explicitly requested delivery formats.
