# Editable motion pipeline

## Implementation contract

The pipeline uses the existing renderer and separates artwork, performance, compositing and approval. Document 4 scene programs and Rig 4 portable programs store named controllers, sparse motion blocks and typed constraints. Human controls and agent commands edit the same program. Old document/rig formats keep their existing playback; new behavior is an explicit version opt-in.

The shared application evaluator samples sparse keys and block offsets, resolves controller spaces and dependency order, applies IK/aim/attachment relationships, then supplies poses and transforms to rendering, overlays, scene review and exports. Cross-object references stay scene-local; portable rig export must not retain dangling scene IDs. One directed driver owns a grip. Targets and intervals are editable data, not frame-by-frame cleanup.

Motion preparation follows action intent → composed finished key pose → part/hidden-paint preparation → registered rig and drawings → sparse performance → separate technical and visual review. Keep Original and Detailed authorities distinct. The former family example remains evidence of a limited rigid gesture, not natural acting; a corrected bird or mask alone does not resolve that limitation.

## Operator and file behavior

- Controllers have labelled targets in rig, stage or referenced-object coordinates. Portable controllers use only rig space.
- Paths, transforms and deterministic oscillations provide explicit additive offsets. Reuse existing sprite paths; avoid double motion.
- Full-strength IK contacts are checked between poses; partial weights relax contact. Gaze uses coordinated aims and actual registered head-angle art.
- Directed socket attachments preserve authored local grip offsets. Cycles, missing targets and conflicting drivers are errors.
- Duration, loop intent and timeline tail are explicit for new scenes. Legacy omitted tails retain one-second behavior.
- Rig 4 raster meshes are bounded, real weighted deformation of existing validated PNGs. Rigid rotation does not establish bending.
- Importable masters and optional compatibility bakes are separate files. Preview/export must share evaluation, including masks and dependency closure.

Composer's `motion-program.mjs` and Mid-century Ink's `controls.mjs` require a selected supporting checkout. They compile a small harness against actual app sources, import/validate, inspect sampled intermediate contacts and scene readiness, then atomically write complete JSON. Large payloads are never returned through giant stdout results. Failure preserves the old destination.

## Acceptance evidence to record at delivery

Record actual RED/GREEN tests, old/new import coverage, malformed operators, dependency cycles, target spaces, nested/mirrored transforms, joint limits, reachable/unreachable contacts, arbitrary seeks, attach/release intervals, drawing transitions, duration/tail, loop pose and velocity, reduced motion and import/edit/save/reopen/export. Inspect examples at useful viewing size for anatomy, seams, clipping, identity drift, facing, occlusion and contact. Sampling validation alone is not proof at every continuous time.

The new benchmarks must prove both general object motion and prepared character performance. Detailed: invented family, blink, perspective head drawing change, plane lift with maintained grip, and correctly facing outside bird behind the window frame. Original: composed child/bedroom and generic plush animals including bread, with restrained expressive/environmental movement. The separate mesh fixture must prove actual editable deformation and rest/edge/export correspondence.

## Release workflow

Private plugin baselines were verified as Mid-century Ink 1.8.1 and Composer 0.7.0 before this implementation. Candidate versions are 1.9.0 and 0.8.0. Refresh source baselines and schema fingerprints, retain omitted private reference/identity files, commit source, push and open/update the app PR, then package committed overlays with checksums. Guard private updates against the observed release and verify read-back. No merge or application deployment is implied. Tests and rendering evidence are reported when actually run; this architecture document itself is not a completion certificate.
