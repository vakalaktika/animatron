# Prepare illustrations for editable performance

Resolve Original / Classic graphic or Detailed storybook from the actual project and existing references. Preserve authorities, proportions and approval records. Reference people establish drawing quality; they are not automatically approved saved characters.

## Illustration before rigging

1. Define action, emotional beat, cast, framing, focal point, palette and selected treatment.
2. Compose foreground, cast, props and background, including overlaps, negative space, gaze and contact points.
3. Finish a convincing still or key pose before finalizing bone structure. Review faces, hands, anatomy, silhouettes and props against the selected actual references.
4. Prepare only the motion range required by the action. Separate parts, reconstruct concealed paint, register pivots/overlaps and inspect extreme poses. A flattened image is not a clean rig.
5. Author sparse controller motion, prepare registered head/eye/mouth/hand drawings, and review transitions in the actual app.

Construction volumes remain useful for consistency and views. Finished contours can have authored curves, asymmetry, taper, clothing and species-specific anatomy. Avoid making final characters from mandatory primitive hulls. Detailed requires coherent descriptive construction, not extra outlines, texture or gradients.

For complete environments, group large value/colour masses first, then a few coherent props and supporting details. Use shelf thickness, furniture contact and window framing consistently. Draw hands around their actual prop grip; don't place unrelated fingertips beside it. Keep interior marks purposeful and leave breathing room around the focal action. For expressive poses, coordinate weight, shoulder, elbow, wrist, gaze and silhouette rather than giving every part identical drift.

## Portable controls command

```sh
node scripts/controls.mjs character.mci.json controls.json --out character.editable.mci.json --repo /path/to/animatron --offline
```

`controls.json` contains `{"version":1,"motion":{...}}`. It replaces the portable program deliberately and preserves artwork and unaddressed asset fields. Read the existing program first and retain unchanged operators. Rig 4 portable controllers use rig-canvas coordinates and `space:"rig"`; external clip references belong in Composer's Document 4 instance motion.

```json
{
  "version": 1,
  "motion": {
    "controllers": [{"id":"hand-target","name":"Hand","space":"rig","x":320,"y":180}],
    "constraints": [{"id":"arm-contact","type":"ik","rootId":"upper-arm","midId":"forearm","tipId":"hand","targetId":"hand-target","bend":1,"weight":1}]
  }
}
```

Use the rig's real IDs and inspected bend direction. Controller keys use sparse ordinary document key records `{time,value,ease:{name:"inOut"}}`. Blocks can offset controls with `path`, `transform`, or `oscillate`, with start/duration/repeat/alternate timing. The importer validates names, finite values, limits, dependencies and budgets. Unreachable targets fail the command's sampled evaluation instead of silently becoming successful contacts.

The command requires an explicit checkout with Rig 4 support and uses its importer/evaluator. It writes the full file atomically and prints only a summary. It does not fetch a runtime, install packages, or certify the deployed app. Legacy `sparse.mjs` and baking tools remain Rig 1–3 workflows; use the new command for persistent controls rather than feeding Rig 4 to an older standalone sampler.

## Replacements and selected bending

Prepare registered head angles, eyelids, mouths, grips and other action drawings. Keep drawing selection discrete; parking-based legacy drawings remain readable. Concealed hair/neck/sleeve areas need authored paint. A head turn requires perspective artwork and coordinated pose timing, not a rotated flat face or a ghosting crossfade.

Rig 4 `meshes` can deform a validated raster attachment with weighted bones and fixed triangles. Keep this to selected sleeves/cloth or another demonstrated need. It is not vector deformation, automatic separation, hidden-area reconstruction, or a full weight-painting UI. Inspect rest correspondence, transparent edges, seams, extreme poses and exported transitions. See `mci-rig-v4.md` and schema for fields and budgets.

Maintain editable masters separately from optimized/baked copies. Deliver an importable rig plus source art, pose review, animation preview and reduced-motion still when rendering succeeds. Structural validation, visual quality and user approval are separate; do not advance identity approval based on any tool result.

## Human node workspace

A supporting Animatron checkout provides a **Nodes** workspace alongside the stage and timeline, with draggable cards, typed drag/tap/keyboard connections, a selected-object scope and a whole-scene scope. It derives cards from existing controllers, blocks, constraints, bones and sockets. Do not invent a separate executable nodes/edges payload. Give operators meaningful `name` values and stable IDs scoped to their owning character. Name sockets for their actual registration, such as `plane-grip`, rather than encoding timing into IDs.

Motion blocks move an object or its controller additively; they are not serial effect chains. Controller outputs target IK/aim relationships. Object/socket frames drive attachments or coordinate spaces. The saved program and validators enforce these meanings, reject cycles and competing drivers, and preserve artwork. Paint order and stage masks remain separate scene controls.

For a hand/prop action, expose a named hand target and direct limb chain; give the hand a registered grip socket; attach the prop in the composition; animate only sparse target poses and action timing. Human edits use the same data as agent commands. Existing rig controls are marked as inherited; scene edits override them. Removing an inherited operation suspends it rather than deleting the rig master or allowing the base control to reappear unexpectedly.

Editor card positions/viewport may be saved under optional `editor.motionGraph` version 1. This metadata never changes playback. Let the app generate its safe scoped node IDs and layout; authoring does not require manually placing graph cards. A project remains valid without this metadata. Save the complete editable JSON and test reopen/export. Do not certify the deployed viewer from a local editor test.
