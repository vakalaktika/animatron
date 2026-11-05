# Scene structure: direction, space and action readiness

The previous family example proved sparse interpolation, but failed as acting proof. The right-facing bird moved left and lacked an enforced aperture, and most characters were painted into one static plate. These are production-structure failures; more easing or keys cannot repair the missing parts.

## Deliverables

- [Scoped spatial proof composition](sunroom-structured.animatron.json): document3, imported unchanged, with two manually inspected stage-space sky regions preserving the window mullion and right-facing bird moving right. The hand/plane remain one rigid carrier; existing head/blink states remain discrete. **The family remains stiff/limited; this is not claimed as a finished natural-acting scene.**
- [Actual app-rendered preview](preview.mp4), [representative frame](preview.frame-3.50.png), [opening/reduced-motion still](preview.frame-0.00.png).
- [Scoped motion plan](scoped-motion.plan.json) passes direction/portal/control checks.
- [Natural-acting requirements](natural-acting-required.plan.json) intentionally fail: torso, upper arm, forearm, hand and hair controls/artwork are missing. This preserves the unmet production requirement rather than silently narrowing it.
- [Editor rejection screenshot](qa/acting-readiness-rejected.png): a human switches the requested action to articulated acting and sees missing controls.

## Reusable implementation

`ScenePlan` declares each actor’s action/required parts and each traveler’s rest facing, intended direction, travel control and interior/exterior space. `engine/sceneReview.ts` samples actual app transforms and checks resolved bound artwork. Empty/malformed plans cannot produce success. These bounded declared checks do not understand an image automatically and do not grade visual acting.

`stageMask.regions` is a validated union of static stage-space polygons. A moving layer’s transforms stay independent of the aperture. The same StageCanvas renderer serves editor, video export and single-layer developer exports. Stage visibility regions can be edited numerically in the human inspector. Paint order remains explicit; masks do not reconstruct a whole depth graph, concealed body parts or foreground silhouettes.

Masked/planned scenes opt into **document3**; existing documents stay2 and rig formats1/2/3 remain unchanged. Earlier application versions reject the3JSON. Hash/short-link creation is disabled for the new format because old viewers may ignore unsupported fields. Deliver the importable JSON and use a supporting app build.

Composer `scene-check.mjs` uses the app importer/evaluator. A stored plan also gates `tween.mjs` output atomically: bad direction/space/articulation leaves existing output intact. Legacy unplanned files retain technical validation without acquiring an acting claim.

## Human workflow

1. Canvas → **Motion structure**: declare action intent and required controls, artwork facing, direction and space.
2. Prepare the real artwork parts needed for the action. Additional bone names do not split a picture.
3. Position and timing → **Stage visibility regions**: author the aperture/foreground geometry and inspect it against the actual illustration.
4. Author coordinated sparse motion only after readiness. Check structure, then inspect representative rendered transitions separately. Neither is user approval.

## Reproduce

```sh
node examples/scene-structure/build.mjs
node plugins/animatron-composer/skills/compose-animatron/scripts/scene-check.mjs examples/scene-structure/sunroom-structured.animatron.json --repo /path/to/animatron --offline
node plugins/animatron-composer/skills/compose-animatron/scripts/scene-check.mjs examples/scene-structure/sunroom-structured.animatron.json examples/scene-structure/natural-acting-required.plan.json --repo /path/to/animatron --offline
```

The second preflight returns failure intentionally. Rendering uses `scripts/preview-scene.mjs`. `scripts/qa-stage-mask.mjs` pixel-tests two moving frames through actual StageCanvas/snapshot export, proving pane visibility and unchanged frame/outside pixels. Extended `qa-illustrated-scenes.mjs` exercises the motion-plan inspector, expected acting rejection, restored scoped intent, drawing/pose edits, save/reopen and rig/composition export at1440/390px with reduced motion paused. No page errors were observed in Chrome156. Other browsers and natural character acting are not verified.
