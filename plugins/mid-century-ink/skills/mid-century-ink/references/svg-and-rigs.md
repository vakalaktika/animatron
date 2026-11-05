# Native SVG and skeletal assets

## Scope and visual access

Use this workflow for explicit SVG/vector requests and animation-ready artwork. Resolve the treatment first (`style-presets.md`). Original: inspect the default historical pair or the guide-supported alternate pair. Detailed: inspect `../assets/detailed-primary-scene-v1.jpeg` (and the adult face crops when adults appear) and read `detailed-character-style.md`. Then author the requested subject using that treatment's drawing mechanics; vectors carry the same treatment as raster art, and the rig records it in `metadata.treatment` (`classic-graphic` or `detailed-storybook`). SVG is a medium, not permission for polished mascot geometry, thick enclosing outlines, gradients, or dense detail. Keep ink and flat fills independent where the references support it.

Read `references/mci-rig-v1.md` for the exact portable skeleton contract. The adjacent schema defines field shapes; `mci-rig-core.cjs` implements the shared math; `example-character.mci.json` is diagnostic test data, not a stylistic source. The validator is `scripts/validate-rig.cjs` relative to the skill root.

## Select the output

- Static artwork: native SVG with editable groups/paths, correct viewBox, intentional transparent or solid background, and a PNG preview if supported.
- Editable layered artwork: stable semantic group IDs, independent ink/fill pieces, and a short part inventory.
- Animation-ready artwork: the SVG PLUS a `.mci.json` master containing that SVG, actual bones, bindings, slots, rest pose and demonstration motion. Static SVG alone is not a skeletal deliverable.

Preserve editable source separately from playback exports. Lottie or video output does not by itself preserve the editable skeletal master. Claim destination-tool compatibility only after import has been tested against that tool/version.

## Finish illustration, then prepare movement

0. Follow `illustrated-scene-production.md`: finish and inspect the key pose, complete setting and props before finalizing bones. Use 3D construction for proportions/perspective where useful; author finished curves independently. Each view gets registered art and view-appropriate joints/limits. Preserve the illustration when splitting pieces.
1. Determine the subject's structure and intended actions. Choose human, animal, or articulated-object topology; never force all subjects into a human rig. Static props may use a root with the relevant hinges; full-body characters need the chains needed for their intended motion.
2. Locate functional attachment/bend points from the subject's actual stylized geometry, not SVG bounding-box centers. Plan shoulder/elbow/wrist or hip/knee/ankle chains, head/neck, tails, ears, stems and hinges where useful. Distinguish character-left from viewer-left explicitly.
3. Position bones in parent-local coordinates using the authored rest pose. Add meaningful semantic roles, realistic rotation limits for the intended drawing, and slots such as grips or hat anchors. Label uncertain inferred joints for review in metadata. Do not claim that one pose reveals unseen anatomy with certainty.
4. Construct complete movable pieces with sufficient joint overlap and sensible paint order. Reconstruct concealed portions economically for motion and identify them as inferred when source accuracy matters. Keep a part's ink and color bound consistently so neither floats away during posing.
5. Bind SVG groups to actual bones using the contract's inverse-rest matrices. Never bake motion into a single picture and call it skeletal. Begin with rigid articulated shapes to preserve the graphic style. Weighted mesh deformation is not implemented; do not claim bending from rigid rotation. Rig 2 adds registered raster attachments and discrete drawing states; read `mci-rig-v2.md` when using them. Keep ordinary vector rigs at version 1.
6. Provide small example motions suited to the asset. Reusable actions require compatible semantic roles and joint limits; do not promise every action works on every skeleton. Keep asymmetry, held poses and deliberate gesture. Avoid arbitrary continuous wobble and large elastic distortion by default.

## Validation

Run `node scripts/validate-rig.cjs path/to/asset.mci.json` when available. It checks hierarchy, numeric fields, bindings and animation data; it does NOT certify visual fidelity or import compatibility.

Render the original SVG and evaluated neutral, bent, and extreme permitted poses. Compare against the selected treatment's visual inputs at actual use size (the historical pair for Original, the primary scene for Detailed). Check silhouette, facial economy, ink/fill balance, shallow space, color discipline, and selective texture. Check visible feature counts and connected limbs, allowing profile/occlusion and intentional stylization. Inspect joint gaps, detached strokes, paint order, canvas clipping and loop endpoints. Perform a second pass on every subject and a third after a correction. Report only checks actually performed.

When the destination importer is available, import, pose, save, reopen and export the asset. Validate the re-exported master and compare its hierarchy/bindings/slots/clips. Include reduced-motion stills where animation is displayed. If rendering or the destination tool is unavailable, deliver the editable source with the exact unverified checks stated plainly.
