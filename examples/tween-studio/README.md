> Correction: this example proves sparse interpolation only. It failed directed travel and scene-space review, and its family artwork cannot support natural articulated acting. See [scene structure correction](../scene-structure/README.md). Fewer keys were not a visual-quality improvement by themselves.

# Tween Studio — sparse editable motion

Create artwork once, separate inspected moving parts, author a few poses and choose how each part travels between them. The application evaluates the times between poses. Editable JSON stores keys/curves; rendered MP4 necessarily stores video frames.

## Examples

| Example | Editable composition | Editable rig/art | Actual application preview |
| --- | --- | --- | --- |
| Articulated lamp, 6 seconds | [lamp.animatron.json](lamp.animatron.json) | [lamp.mci.json](lamp.mci.json), [SVG](lamp.svg), [source rig](lamp.source.mci.json) | [lamp.mp4](lamp.mp4), [still](lamp.frame-1.50.png) |
| Existing generated family scene, 8 seconds | [sunroom-tween.animatron.json](sunroom-tween.animatron.json) | Embedded original raster attachments, bindings and drawing states; [original paint sources](../illustrated-scenes/sunroom-glider/README.md) | [sunroom.mp4](sunroom.mp4), [still](sunroom.frame-1.50.png) |

The lamp is a deliberately simple articulation fixture, not a new Mid-century Ink style reference. Its lower arm, upper arm and shade have independent eased tracks: **15 bone keys**, plus five paper rotation keys. All three joints stay attached throughout the timeline. The paper is an independent object layer. No generated images were required for this fixture.

The family revision retains every image payload, SVG, binding and registered head/blink drawing. Its rigid lift carrier uses **8 keys instead of 193**; the bird carrier uses **6 instead of 193**. This is **14 versus 386 transform records**, a 96.4% reduction in those records. The image payload still dominates file size. It is a new motion interpretation, not pixel-identical motion compression. The girl's hand and plane remain one carrier. The bird retains a single wing drawing and an invisible reset; the family is not a fully articulated character rig. Static mother/boy parts remain in the plate. No identity or approval changes.

## Human workflow

1. Import the composition in the updated app.
2. For a whole layer, open **Position and timing → Tween to…**, set a destination, length and curve, then **Create tween**. Only changed properties receive keys. Existing keys inside that segment are replaced; other tracks and keys remain.
3. For an illustrated part, select the rig and a named bone in **Skeleton**. Capture a start key, move the playhead and pose the part again. **Animation clips → Keys for…** exposes key time, angle, position and outgoing tween curve, including the existing custom timing editor.
4. Scrub between keys and inspect contacts/overlaps. Save the `.mci.json` rig master or download the composition JSON. Both retain the sparse keys.

First-time auto-keying after time zero seeds the start pose. Exact loop closing-key values can be edited in controls without overwriting time zero. The playback canvas still wraps to the opening pose at the exact loop endpoint; deliberately mismatched closing poses should be inspected just before that endpoint. Whole-pose recording remains available separately and preserves existing timing.

Object transforms combine with existing sprite paths/reveals; choose one intentional movement system for the action. Object property tracks hold after the last key; whole-composition replay repeats them. Bone animation looping is explicit. No automatic velocity matching is claimed.

## Agent workflow and reproducibility

`build.mjs` writes the lamp source and two concise motion specs. Then use Composer:

```sh
node plugins/animatron-composer/skills/compose-animatron/scripts/tween.mjs examples/tween-studio/lamp.base.animatron.json examples/tween-studio/lamp.motion.json --out examples/tween-studio/lamp.animatron.json --repo /path/to/animatron --offline
node plugins/animatron-composer/skills/compose-animatron/scripts/tween.mjs examples/illustrated-scenes/sunroom-glider/sunroom-glider.animatron.json examples/tween-studio/sunroom.motion.json --out examples/tween-studio/sunroom-tween.animatron.json --repo /path/to/animatron --offline
```

A host may need `ANIMATRON_COMPOSER_CACHE` set to a writable directory with the existing tsx loader. The CLI uses the actual target importer and refuses repairs, invalid specs, truncation of preserved tracks and duration mismatches before atomic output. MCI `scripts/sparse.mjs` supplies native independent part tracks; legacy `motion.mjs` baking remains explicit for older targets and procedural actions.

## Verification and limits

- Both compositions pass real app import unchanged and have zero timeline tail; app duration is exactly 6/8 seconds. Actual StageCanvas + renderVideo previews exported H.264 at24fps; ffprobe container times are 6.000052/8.000069 seconds (encoding timescale rounding).
- Checked lamp joint coincidence at48samples/second, independent timing, generated-art asset identity, drawing-state preservation, opening/closing pose and near-seam angular velocity. Bird reset occurs while hidden.
- Built editor in isolated Chrome156: import → edit curve/angle/time → create object tween → save/reload → rig and composition export; reduced-motion arrival stayed paused; desktop1440 and mobile390 inspected; no page errors. Existing family drawing/pose edit journey also passed.
- [QA exports](qa/edited-export.animatron.json) intentionally contain edit-test changes and are not seamless benchmark masters. [Rig controls screenshot](qa/rig-tween-controls.png), [object controls](qa/object-tween-controls.png).
- Rig3 is explicit; old Rig1/2 imports are retained. Old application builds reject Rig3. Plugin updates do not deploy the application. Test using this PR revision until a supporting app release is verified.
- No mesh deformation, automatic body-part extraction, automatic constraints, lip sync, AE project export or cross-browser/native paint-editor verification. This is an additive motion-authoring step, not feature parity with After Effects.
