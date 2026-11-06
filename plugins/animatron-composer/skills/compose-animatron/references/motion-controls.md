# Editable motion: paths, controllers and contacts

Target the actual supporting app checkout with `--repo`. Current private plugin versions do not establish deployed application support. New programs require Document 4; portable programs inside a rig require Rig 4. Keep unchanged old formats intact.

## Author the action first

Write the emotional beat and shot framing, then anticipation → action → expressive hold → settling. Identify independently prepared parts, gaze, supporting foot, grip socket, foreground occluders and travel facing. Preserve the chosen Original or Detailed treatment and identity records. If action-ready parts or concealed paint are missing, coordinate Mid-century Ink to prepare them instead of sliding a flattened scene.

Use simple named human controls: Body, Hand, Foot, Gaze, Head Angle. The timeline changes their timing; the optional node view changes their relationships. Both edit the same declarative data. No arbitrary expressions or new framework are needed.

## Composition command

```sh
node scripts/motion-program.mjs scene.json motion.json --out scene.editable.json --repo /path/to/animatron --offline
```

The request replaces only explicitly addressed motion programs. Artwork, bindings, metadata, drawings and unaddressed tracks remain intact. `rigMotion` addresses a portable rig program; `motion` addresses scene-instance motion. Inspect existing programs before replacing one; copy the unchanged operators into the requested complete program.

```json
{
  "version": 1,
  "duration": 8,
  "loop": true,
  "targets": [{
    "clipId": "plane",
    "motion": {
      "blocks": [{
        "id": "gentle-lift",
        "type": "path",
        "start": 0,
        "duration": 4,
        "repeat": 2,
        "alternate": true,
        "ease": {"name": "inOut"},
        "points": [{"x": 0, "y": 0}, {"x": 12, "y": -30}, {"x": 22, "y": -45}]
      }]
    }
  }]
}
```

This adds a motion offset to placement; a pre-existing sprite path still contributes its own movement. Avoid double motion. `orient` rotates to travel tangent and `facingOffset` accounts for actual artwork orientation. Do not automatically flip asymmetric character artwork without inspection. `transform` blocks add from/to property deltas; `oscillate` blocks are explicit, time-evaluable secondary offsets. Duration/repeat/alternate retime reusable blocks without storing intermediate frames.

For a character hand target, store a `space:"rig"` controller with sparse x/y keys in rig-canvas units. Add `type:"ik"` with actual root/mid/tip bone IDs, `targetId`, and explicit `bend`. A `space:"object"` controller can reference another `clipId` and optional socket to coordinate contact; those references are scene-local. A carried plane can instead use a directed `attach` constraint to the character's grip slot. Choose one owner: the hand carries the plane, or the plane targets the hand. Never make both drive each other.

Attachment offsets are target-local and must be authored from the current world pose at the handoff. Full influence is a lock; partial influence is a blend. Inspect contact interval boundaries, limits and impossible reaches. Gaze can coordinate head and a smaller torso aim; head perspective is still supplied by discrete registered drawings, never inferred by rotating a flat face.

## Validation and delivery

The command imports the source, refuses silent repairs, validates operators/references/budgets, samples actual intermediate poses including block/contact boundaries, checks declared scene readiness, and writes only after success. A failed write or validation leaves the prior output intact. A complete result goes directly to a private temporary file and is atomically renamed; stdout contains a short summary, avoiding truncated large JSON payloads.

The output declares content duration, loop intent and zero automatic tail. Check visual and velocity loop continuity separately. The bounded sampling preflight is evidence at sampled times, not a proof for all continuous times or a visual review. Inspect full-size key poses and transitions through the application's renderer. Technical PASS, visual review and user approval are separate records.

Deliver the editable composition and rig/art masters, rendered preview, reduced-motion still and limitations. Deliver JSON even if a share link is too large or unsupported. Preserve local/deployed compatibility labels. Explicitly baked playback copies are separate from masters; cross-object dependencies must not disappear from single-object exports.

## Human node workspace

A supporting Animatron checkout provides a **Nodes** workspace alongside the stage and timeline, with draggable cards, typed drag/tap/keyboard connections, a selected-object scope and a whole-scene scope. It derives cards from existing controllers, blocks, constraints, bones and sockets. Do not invent a separate executable nodes/edges payload. Give operators meaningful `name` values and stable IDs scoped to their owning character. Name sockets for their actual registration, such as `plane-grip`, rather than encoding timing into IDs.

Motion blocks move an object or its controller additively; they are not serial effect chains. Controller outputs target IK/aim relationships. Object/socket frames drive attachments or coordinate spaces. The saved program and validators enforce these meanings, reject cycles and competing drivers, and preserve artwork. Paint order and stage masks remain separate scene controls.

For a hand/prop action, expose a named hand target and direct limb chain; give the hand a registered grip socket; attach the prop in the composition; animate only sparse target poses and action timing. Human edits use the same data as agent commands. Existing rig controls are marked as inherited; scene edits override them. Removing an inherited operation suspends it rather than deleting the rig master or allowing the base control to reappear unexpectedly.

Editor card positions/viewport may be saved under optional `editor.motionGraph` version 1. This metadata never changes playback. Let the app generate its safe scoped node IDs and layout; authoring does not require manually placing graph cards. A project remains valid without this metadata. Save the complete editable JSON and test reopen/export. Do not certify the deployed viewer from a local editor test.
