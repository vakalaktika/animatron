# Editable motion pipeline examples

Use the supporting application revision from the accompanying PR. Import JSON through **Compositions → Import JSON**. These Document 4 masters intentionally do not produce public opening links until the receiving application supports the format; no application deployment is included.

## Detailed — Mira and the garden glider

- `illustrated/detailed-illustrated.animatron.json`: self-contained layered master, 1280×720, eight-second loop, zero tail.
- `illustrated/preview.mp4`: 24 fps export from the actual StageCanvas/renderVideo path.
- `illustrated/key-pose.png`: rendered action pose; `illustrated/reduced-motion.png`: quiet starting pose.
- `illustrated/daughter.mci.json`, `plane.mci.json`, `room.mci.json`: editable rig masters. The finished source artwork, transparent parts atlas, reconstructed room and registration records remain beside them.

The daughter has separate torso, sleeve, forearm, hand and registered head drawings. Move **Lift the paper airplane** to pose her hand; the arm solves between keys and the plane follows its named grip. The pose includes anticipation, a lift, hold, perspective drawing change, blink and settling. The bird travels right beyond a validated window aperture. Mother and boy deliberately remain still in the composed background plate; this does not claim independently rigged performance for the entire cast.

Artwork was generated against the existing Detailed authorities, then separately prepared and manually registered. The parts atlas is not claimed to be automatic segmentation. A concealed shoulder paint correction was added after app-frame review. The small plane is native vector artwork, avoiding a duplicate atlas payload. Distributed PNGs omit unsupported ancillary metadata without changing IDAT pixels. Original generated files remain in the local image-generation archive outside the public source.

## Original — Breadtime stories

- `original-bedtime.animatron.json`: self-contained editable vector scene, eight-second loop, zero tail.
- `original-preview.mp4`: actual application export.
- `original-bedtime.key-pose.svg` / `.png`: finished graphic artwork.
- `original-bedtime.mci.json`: child, bread/bear/rabbit plush, room, blanket and lamp groups, registered blink and sparse animation.

This scene uses the distinct simple Original treatment. The child blinks and makes a restrained head/body gesture; bread plush and the lamp move selectively. It does not use the Detailed face construction.

## Additional fixtures and review

The `detailed-family.*` vector scene remains a technical fixture. It is deliberately not offered as evidence of Detailed style parity. The actual Detailed benchmark is the layered scene above. `../deformation-proof/` proves genuine raster bending with an editable cloth fixture; it is separate from the family illustration.

`technical-results.json` records 241 evaluated samples per example, contact/grip residuals, duration, pose/velocity seam checks and import/save/reopen correspondence. Masked travelers are excluded from pose-endpoint comparison because their resets occur outside the aperture. Selected actual frames were inspected separately for anatomy, shoulders, hands, registration, prop contact, clipping, facing and occlusion. These checks are internal review, not user approval.

`qa/browser-results.json` records the isolated Chrome journey: import, target field/keyboard edits, path retiming, optional relationships, mobile edit, artwork preservation, save/reopen/JSON export, prepared mesh weight edits and reduced-motion pause. PNGs show the editor. Other browsers and a full arbitrary mesh/node authoring workspace are untested/out of scope.

Rebuild vector assets with `node examples/motion-pipeline/build.mjs`; register the unchanged generated parts with `node examples/motion-pipeline/build-illustrated.mjs`. Render using `scripts/preview-scene.mjs`. The shared evaluator is used by all previews; the generated art-direction still is separately labelled and is not substituted for an application preview.
