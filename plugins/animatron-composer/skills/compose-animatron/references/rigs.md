# Rigged characters (Mid-century Ink Rig 1)

From `docs/mci-rig/mci-rig-v1.md` (the contract shared with Agent Torres and
the Mid-century Ink generator) and the studio's `engine/rig.ts`,
`engine/rigSvg.ts`, `lib/rigImport.ts`.

## What this plugin does and doesn't do

- **Does:** put a rig the user supplies into a composition, size and place
  it, pick which of its clips plays, add the studio's `wave`/`nod` presets,
  write new motion clips as poses over time, set a still pose. All through
  the studio's own engine functions, so joint limits, key rules and the
  contract are enforced exactly as in the studio.
- **Doesn't:** draw or rig characters. The artwork, bones and bindings come
  from the user: a `.mci.json` from Agent Torres, the Mid-century Ink
  generator or skill, or the studio's *Save rig*. Never edit a rig's `svg`,
  `bones` or `bindings` by hand; never invent a rig. No rig in the
  conversation → ask for one, or use `examples/rigs/example-character.mci.json`
  (the studio's diagnostic fixture) only for a demo, and say so.

## Steps

1. **Inspect** the rig: `node scripts/rig.mjs inspect character.mci.json`.
   It runs the studio's rig import (4 MB budget, contract, SVG subset) and
   lists bones (id, role, rotation limits), clips, slots, and whether the
   roles allow the `wave` and `nod` presets. A rig that fails here can't be
   used; report the reason.
2. **Write a placement spec** (JSON, next to the rig; paths are relative to it):

   ```json
   {
     "rig": "character.mci.json",
     "stage": { "width": 1080, "height": 1920 },
     "id": "hero", "name": "Hero", "start": 0.3,
     "x": 540, "y": 1180, "height": 900,
     "presets": ["wave"],
     "motions": [
       { "id": "cheer", "name": "Cheer", "duration": 1.6, "loop": false,
         "keys": [
           { "time": 0,   "pose": {} },
           { "time": 0.6, "pose": { "arm.left.upper": -110, "arm.right.upper": 110, "head": -12 } },
           { "time": 1.6, "pose": { "arm.left.upper": -110, "arm.right.upper": 110 }, "easing": "linear" }
         ] }
     ],
     "play": "cheer"
   }
   ```

   - `x`, `y`: where the **centre of the rig's canvas** goes, in stage px.
     `height` sizes the canvas in px (or give `scale`). The art usually
     doesn't fill its canvas; check the card.
   - `presets`: the studio's role-gated clips, `wave` (needs the
     `arm.left.*` roles) and `nod` (needs `head`). Refused when the roles
     are missing, never mapped onto other bones.
   - `motions`: each key is the **whole pose at that time**. Bones are named
     by role (`arm.left.upper`) or id. A number is a rotation delta in
     degrees from rest; `{ "x", "y", "rotation" }` also moves the joint (in
     the parent's frame, mostly for the root). A bone named in any key but
     missing from another is at rest there. Times start at 0 and strictly
     increase up to `duration` (≤ 600 s). `easing` (`linear`, `hold`) shapes
     the move from that key to the next. Rotations past a joint's limits
     are clamped and reported. A looping motion should end on its first pose.
   - `play`: the clip that plays from `start` (default: the rig's first
     clip). `null` shows the still `pose` instead (same bone syntax).
   - Left/right are the **character's**, not the viewer's. The sign of a
     rotation that raises a limb depends on how the rig was built, so
     **render a card to check** (below) rather than guessing.
3. **Place it:** `node scripts/rig.mjs place spec.json --into piece.json`
   (replaces a layer with the same id, else appends; `--index 0` puts it
   at the back so text paints over it). Or `--out clip.json` to just write the layer.
4. **Validate** `piece.json` as usual. Rig layers are checked with the
   studio's `validateRig` and `parseRigSvg` too.
5. **Look at it:** `node scripts/card.mjs piece.json --time <t>` at the
   start, the key poses, and the end. Fix wrong-way limbs by flipping signs.

## Timing

- A rig layer lasts as long as the clip it plays (a still pose counts as
  1 s). Like every layer it is **hidden before `start`** and appears already
  playing; to have a character stand still first, start it earlier with a
  motion whose opening keys hold the rest pose. A clip that plays once holds
  its last pose after.
- A looping clip (the presets loop) makes the whole composition loop; its
  length then covers one cycle from the layer's start.
- The studio's link preview card shows the moment two thirds of the way
  in. For pieces shared as short links, time a telling pose to land there.

## Limits

4 MB per rig (JSON), 128 bones, 64 clips, 10,000 keys. Rigs make
`#share=` links long: a ~20 KB rig fits; much bigger ones go out as the
JSON file only. Attachment slots are kept but not used for placement yet.


## Illustrated parts and replacement drawings (Rig 2)

The companion application introduces an explicit version 2 extension while preserving version 1 vector imports. Mid-century Ink authors the artwork and its registrations; Composer's placement keeps them intact. `rasterAttachments` carries validated transparent PNG parts inside bound SVG groups; `drawingSets` defines registered replacement groups and `drawingTracks` selects them with discrete hold keys. Paint order is SVG group order and transforms use existing inverse-rest bindings. Do not add arbitrary `<image>` or external URLs to Rig 1 SVGs. Runtime budgets and the precise schema are owned by the application's `docs/mci-rig/mci-rig-v2.md` and bundled Mid-century Ink contract. Version 2 does not imply mesh bending.

For an airplane lift, use a shared carrier bone/slot or bake a contact constraint in Mid-century Ink. Render intermediate poses to verify hand-to-plane contact. Head turns require a change of registered drawing/perspective; rotating a flat face is not a turn. Inspect seam coverage and transparency before declaring layered illustration ready. Existing parking-based assets are retained; explicit drawing states are preferred for new rigs.
