# Sparse tween authoring implementation plan

## Problem and source evidence

Object transforms already interpolate through `engine/keys.ts` and `transform.ts`. Rig bones interpolate only linear/hold in `engine/rig.ts`. Mid-century Ink `scripts/motion.mjs` bakes eased poses into dense linear samples. This creates avoidable keys and weakens human editability. A flattened picture still needs inspected part separation; interpolation cannot invent anatomy.

## Plan and acceptance criteria

1. **Native interpolation.** Introduce explicit Rig 3 optional outgoing tween curves, retaining linear/hold and all Rig 2 attachments/drawings. Validate unknown curves and malformed imports. Existing 1/2 files remain unchanged. Shared runtime must agree with the application; legacy samplers must evaluate correctly or reject unsupported input.
2. **Human authoring.** Add object “Tween to…” controls (destination, duration, curve), selected-bone recording, direct key edits, and smooth rig easing. Seed first auto-key with a start pose and allow loop closing-key edits. Preserve undo/autosave/export paths.
3. **Agent authoring.** Composer accepts sparse independent object/part tracks in seconds; preserves identities, drawings, bindings and unaffected tracks; validates through actual application code before writing. MCI supplies sparse native authoring while retaining legacy baking explicitly.
4. **Proof.** Deliver an articulated editable fixture and a sparse revision of the existing generated-art scene. Inspect intermediate frames using the app renderer. Test old/new imports, invalid curves, hierarchy/contact, easing, local timing, loop endpoints/velocity, save/reopen/export and reduced motion.
5. **Delivery.** Update plugin instructions, contracts, versions and changelogs; build installable updates from committed source; commit/push and update PR. No main application deployment or merge.

## Boundaries

No renderer replacement, new dependencies, automatic image separation, mesh deformation, native After Effects export or promise that tweening rigid parts alone yields full character acting. Replacement drawings remain discrete for perspective changes and blinks. Generated art and approval records remain separate from technical validation.

## Evidence ledger

Implementation and final checks are recorded below as they complete.

### Completed implementation and evidence

- Rig3 extension, strict validation, shared runtime and schema; old formats retained. Native timing matches app at sampled preset/custom/hold boundaries. Generated dependency-free easing is checked against source.
- Object endpoint form, selected-part keys, direct time/value/curve edits, baseline seed and numeric closing-key edits implemented. Whole-pose recording preserves curves/holds. Collision-tolerant endpoints survive reopening.
- Composer sparse command validates against actual app before atomic output; MCI native sparse command retains legacy bake separately. Contact consumers sample correctly or fail explicitly.
- Two actual-app exported previews delivered in `examples/tween-studio`. Family transform records386→14; lamp15articulatedbonekeys+5objectkeys. Art payloads preserved; reduced-key motion is a reinterpretation rather than lossless compression.
- RED: missing module/new behavior and existing baseline/endtime failures reproduced. Review RED: near-key collision, held boundary and lost whole-pose easing reproduced; corresponding GREEN checks pass.
- New tween modules:100% statements/lines/functions and98.5% branches. Full verification evidence and source-control/release status recorded with delivery.
- Built Chrome156 journeys PASS for new controls and existing family drawing edits; save/reopen/export, reduced-motion paused and1440/390viewports. Previews use actual StageCanvas/renderVideo; ffprobe confirms6s/8s24fps exports. Nativepainteditors and other browsers remain untested.

### Deferred boundaries

No mesh bending, AE project export, automatic part separation, automatic constraints, full character rerig, graph-editor replacement or app deployment. Exact loop endpoint remains wrapped on canvas; closing-key numeric controls edit the end pose. A separated rigid forearm is still rigid. Better acting needs intentional additional parts, contact planning and selected replacement drawings, not more sampled keys.
