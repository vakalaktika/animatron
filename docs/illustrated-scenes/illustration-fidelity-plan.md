# Detailed illustration fidelity: execution plan

The first Garden glider examples demonstrate format and motion features. They do not establish fidelity to the Detailed style anchor. Rasterizing those SVGs does not demonstrate preservation of generated illustration quality. Keep the fixtures and their regression evidence, but withdraw that visual claim.

## Scope and art direction

Create one new, invented family scene in Mid-century Ink Detailed. A child shows a paper glider to family in a sunroom craft corner: quiet pride, connected gazes, a clear silhouette around the lifting hand. Use natural cartoon proportions, coherent three-quarter faces, economical tapered marks, grouped hair, shaped hands, broad quiet color regions and a complete setting. Use the existing primary scene and selected adult crops as style evidence only. No character identity or approval record changes.

Eight-second restrained loop, explicit zero timeline tail. Demonstrate a blink, authored head-angle change, hand/plane lift and a bird outside. Most artwork remains still. No new renderer or mesh deformation.

## Phases and acceptance criteria

1. **Finished illustration.** Generate using the actual Detailed visual inputs. Inspect the complete cast and useful-size face/hand crops against the anchor. Record successes and remaining mismatches. Keep prompts and provenance. Internal review is not user approval.
2. **Layer preparation.** Preserve the generated master. Create a clean plate and isolated parts with real transparency; reconstruct concealed areas explicitly. Record source dimensions, positions, anchors, paint order and inferred regions. Inspect composited rest pose and extremes for halos, gaps and identity drift. Do not describe automatic extraction as inspected until it is.
3. **Registered performance.** Prepare compatible open/blink/turned head drawings and a rigid hand/plane carrier. Keep facial marks together. Use designed overlaps and bounded movement; do not claim mesh bending. A drawing swap must change perspective coherently, not just move features.
4. **Application proof.** Build self-contained Rig 2 and composition masters, separate playback copy, reduced-motion still and actual-app animation export. Check contact through intermediate frames; positional and velocity loop continuity separately. Import, edit/pose, save, reopen and export the new assets.
5. **Workflow correction and release.** Explain generated illustration versus native vector deliverables honestly. Mark old examples as technical fixtures. Update affected plugin guidance/version/changelog, package only reviewed changes, and commit/push/update the existing PR. Preserve private references. Do not merge or deploy the application.

## Resource and verification bounds

Reuse existing rendering, validation, QA and packing tools. Generate one scene, then targeted part/edit calls only where needed. Do not broaden application infrastructure without a reproduced gap. Enforce current PNG/JSON budgets; retain higher-resolution source artwork separately if a playback derivative needs reduction. Run focused new-asset tests and required Git hooks rather than repeating unrelated suites manually. Record actual visual limitations instead of declaring success from structural tests.

## Execution evidence

Phases 1–4 are complete for the first Detailed candidate: [Sunroom glider](../../examples/illustrated-scenes/sunroom-glider/README.md). Deliverables include generated source illustration, supervised clean plate and alpha parts, registered blink/three-angle heads, shaped foreground cuff, editable layered paint master, three Rig 2 assets, full-resolution self-contained composition and actual-app MP4. The original source is preserved separately from the rebuilt resting still. See the linked visual review for remaining finish and limited-animation differences; this is not user approval.

Six new asset checks plus six legacy fixture checks pass. Both old/new built-app import/edit/save/reopen/export journeys pass in local Chrome with reduced-motion arrival paused. Actual rendered endpoints match pixel-for-pixel; main lift velocity continuity and the bird's invisible reset are checked separately. Composer accepts the 8.00-second, zero-tail composition; its hash link exceeds budget, so JSON is supplied. The initial restricted-cache Composer attempt could not install its loader; the successful run used an already installed tsx 4 loader through a task-local cache without downloading dependencies.

Phase 5 source changes are prepared on the existing PR branch: Mid-century Ink 1.7.1 corrects generated-versus-vector proof and layered-editability guidance; old fixtures are explicitly relabeled. The plugin update archive and final commit/release provenance are generated under `dist/` after committing and pushing. Application merge/deployment remains outside this work.
