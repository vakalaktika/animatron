# Motion pipeline implementation and release evidence

## Completed phases

- General object/controller path, transform and deterministic oscillation blocks, sparse target keys, repeat/alternate timing and existing curve editing.
- Document 4 and Rig 4 boundaries, legacy playback, validated scene/rig-local targets, analytic two-bone IK, weighted aims, directed socket attachments and continuous release carry.
- Shared evaluated snapshots for transforms, rig rendering/editor overlays, preflight and exports; target spaces, graph ordering and rejected cycles/conflicting writers.
- Human canvas handles, keyboard posing, timing/target/contact forms, optional relationship nodes with canonical enable/disconnect edits and reconnection through the same target/socket selectors.
- Exact duration/loop/tail controls; new edits extend explicit duration to include authored keys. New-format masters are not duplicated into an unsupported legacy autosave slot, fixing the observed quota warning without replacing the project store.
- Rig 4 shared PNG atlases/crop registration with unchanged import protections and budgets. Real bounded raster skinning, a prepared weight inspector and an editable/exported cloth fixture. Cropped-atlas mesh deformation is rejected; whole-texture skinning is supported.
- Plugin authoring commands use actual application import/evaluation, atomic files and short summaries. Existing large-result file capture remains covered. Versioned contracts, instructions, examples and private update overlays are included.

## Verification

The final app suite passes 764 tests across 67 files before release documentation. Focused motion/runtime/validation/deformation/helper coverage exceeded80% statements, branches, functions and lines; measured at93.28% statements,87.26% branches,93.67% functions,98.55% lines. The build performs TypeScript checking. `npm run build` now explicitly selects Next.js’s supported webpack path and succeeds. Turbopack failed to start its local CSS process in this execution environment; the source script selects the verified path so the mandatory pre-push build uses the same check. No renderer/framework replacement was made.

Composer/MCI motion authoring, mirror/schema identity, large-output capture and actual-app atomic CLI tests passed. The existing validator's zero-tail/stale-success-link regression passed with an installed cached tsx loader; initial attempts encountered cache permissions and unavailable registry access. Dependency audit reported zero production vulnerabilities. `git diff --check` is run before the release commit.

Actual Chrome 156 exports verify 1280×720,24 fps and eight-second MP4s for the two main scenes. The cloth fixture is800×480 and four seconds. The isolated desktop/mobile browser checks cover real target/weight edits, reload and JSON export; the detailed source-image payload stays unchanged. The browser script explicitly checks that the large illustrated master is saved, after screenshot review found and prompted the autosave fix.

At 241 samples, Detailed hand error was less than 3e-13 stage pixels, grip error 0, endpoint pose error 0 and estimated seam-speed difference0.069px/s or less. Original pose/seam checks returned 0. These are sampled technical measurements, not a claim about every possible action or device. Performance measurements in the example report cover evaluation only, excluding painting/encoding.

## Deliberate limits

The Detailed mother and boy are part of the illustrated room plate. Only the daughter's planned action is articulated. The vector family diagnostic is not a finished Detailed style proof. Head turns use registered drawings, not continuous3D rotation. The advanced view is a bounded typed relationship view/editor, not an arbitrary expression graph or full After Effects workspace. Mesh topology is prepared; there is no mesh creation/UV editor, automatic separation, universal rerigging or vector-path deformation. Small triangle overlaps can accumulate semitransparent paint; inspect prepared mesh ranges.

Unsupported saved projects keep a recoverable original JSON download; recovery placeholders cannot be opened or synchronized over their original data. Legacy autosave copies remain available.

Original and Detailed authorities and identity/approval assets remain unchanged and private. Technical/visual review creates no approval record. No application merge or deployment is authorized. New formats require the supporting app revision and are delivered as files rather than incompatible public share links.

## Accountability

Changes are on `codex/controller-motion-pipeline`, based on the still-open scene-structure branch/PR 27. The new PR targets that branch to keep this review isolated. Plugin baselines are Mid-century Ink 1.8.1 and Composer 0.7.0; candidate updates are 1.9.0 and 0.8.0. Only version fields changed in their effective manifests. Existing IDs, USER scope, private audience, default prompts and omitted reference assets are retained. Committed overlays are packaged with revision/checksum provenance, then updated through guarded Plugin Creator releases and verified by read-back. Final links, commits and actual release status are reported at delivery.
