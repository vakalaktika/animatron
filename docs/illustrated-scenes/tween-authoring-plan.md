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
