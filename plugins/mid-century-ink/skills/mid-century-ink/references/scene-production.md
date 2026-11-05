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
