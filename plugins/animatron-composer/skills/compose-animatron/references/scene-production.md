# Action-ready scene production

## Plan the action before the rig

Declare the emotional/action beat, gaze/contact targets and which parts must change independently. A character lifting a prop may need torso/shoulder, upper arm, forearm, hand, head and hair controls, plus registered eye/mouth/head drawings. Choose only what the action needs, but verify those parts actually exist and are bound independently. Extra bone names under a flattened image do not create articulation.

Do not describe a rigid carrier or head swap as natural whole-character acting. If the required artwork is missing, rebuild/supervise parts and hidden paint before motion, or explicitly narrow the requested action. Keep that unmet requirement in the handoff. Do not silently replace coordinated acting with gliding layers, small breathing scales or generic sine waves.

## Space is authored, not inferred from names

List outside/interior/foreground objects, apertures, occluding silhouettes and paint order. An “outside bird” name has no rendering effect. Use actual stage-space masks or separated foreground artwork. The updated application supports bounded polygon unions as `stageMask.regions` in stage coordinates, independent of object/bone transforms. Window bars, wall edges, people and foliage require inspected aperture/occlusion geometry. A coarse sky corridor is only a scoped diagnostic, not a complete depth reconstruction.

Mask-bearing compositions use document version3. Default old compositions remain version2; Rig1/2/3 artwork contracts are unchanged. Earlier applications must refuse the new JSON file instead of silently ignoring a mask. Do not supply hash/short links for this scene format until a supporting application is verified; current tooling intentionally gives JSON only.

## Motion has direction and intention

Record the artwork's facing direction. Forward travel must agree with its evaluated facing, including parent/bone transforms. Sprite auto-facing does not apply to every rig or raster carrier. Backward movement must be intentional. Invisible resets can jump; visible movements must be reviewed for spacing and continuity. A still bird drawing can glide; flapping needs real wing parts/drawings and phase planning.

## Handoff and review

Composer's `scene-check.mjs` evaluates a version1 scene plan (`actors` and `travels`) against the actual app. Persist it as `scenePlan` in a document3 master. A declared articulated action must resolve independent bound parts and coordinated motion; exterior travel requires a valid stage mask; facing and sampled visible velocity must agree. `tween.mjs` refuses a failing stored plan before writing output. Missing declarations do not certify anything; these are bounded declared checks, not automatic understanding of the illustration.

Human editors can use Canvas → Motion structure for intent/checks and Position and timing → Stage visibility regions for polygon editing. A passing structural check is separate from visual acting review and from user approval. Inspect actual rendered transitions for contacts, detached marks, clipping, perspective and depth. Never cite fewer keys or a successful export as proof of natural acting.

## Stored plan example

```json
{
  "version": 1,
  "actors": [
    {"clipId":"child","action":"articulated","requiredParts":["torso","upper-arm","forearm","hand","head"]},
    {"clipId":"bird","action":"rigid","requiredParts":["bird"]}
  ],
  "travels": [
    {"clipId":"bird","boneId":"bird","restFacing":"right","mode":"forward","space":"exterior"}
  ]
}
```

Put this object at the document's `scenePlan` field. Actor actions are `still`, `rigid`, or `articulated`; references resolve artwork group IDs or bone IDs/roles. Articulated intent needs at least two independent declared controls with motion, not unrelated moving tracks. Travel `boneId` is optional for whole-layer motion. `restFacing` is relative to the drawn rest artwork, not a construction bone's rest rotation. Travel `mode` is `forward` or explicitly intentional `backward`; `space` is `interior` or `exterior`. Each list is bounded to 64 entries, with at most 64 required parts per actor.

A clip mask example is `"stageMask":{"regions":[[{"x":100,"y":80},{"x":300,"y":80},{"x":300,"y":400},{"x":100,"y":400}]]}`. Those example coordinates are not a fitted window: author and inspect the actual aperture, excluding frames/foreground. The checker establishes mask presence/validity, not whether it traces the real picture correctly. Direction sampling is bounded to at most 240 moments, with low-opacity resets skipped; inspect brief transitions and drawing visibility separately.

From the installed Composer skill directory, run `node scripts/scene-check.mjs scene.json --repo /path/to/supporting/animatron --offline`. Supply a second plan JSON argument to test an unmet action without changing the saved master. A pass certifies only the declarations checked. Never clear or narrow the plan just to make a requested action pass.
