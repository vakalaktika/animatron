# Drag-and-connect motion workspace

Animatron 0.4.0 adds **Nodes** to the app bar. Desktop keeps the stage visible above the graph; phones use a native focused sheet. The existing timeline, layer inspector, renderer and exports remain available.

## Editing

1. Select a character or object and open Nodes. Default scope shows that object plus connected scene controls. Whole scene exposes other objects; All joints reveals unused registered joints.
2. Add a target, path, lift, breathing cycle, limb reach, gaze or prop attachment. Recipes expand into ordinary editable programs. Reach requires a direct prepared chain; a prop hold requires an explicitly chosen carrier/socket.
3. Drag between compatible ports or select their labelled buttons in sequence. Frames, motion, limb joints and targets have different typed meanings. Reconnect replaces the selected operation's input/destination atomically. Invalid/cyclic/competing relationships leave the document intact.
4. Select a node to highlight its owning layer and edit timing, position, strength or bend. Target posing on the stage, sparse keys in the timing strip and the ordinary inspector edit the same saved program. Times in node fields are relative to the owning object's start; the playhead is composition time.
5. Move/resize timing bars, drag key diamonds or use their numeric/keyboard alternatives. Repeats show total occupied time. One completed gesture commits once; Escape or pointer cancellation discards the draft. Explicit composition duration extends to include authored edits.
6. Drag cards, search, zoom and fit the view. Card positions/viewport persist as optional bounded `editor.motionGraph` version 1 metadata. Playback never reads this metadata. Search recenters matching cards. Save JSON to keep both animation and organization.

Rig and scene provenance stays visible. Scene edits override portable rig controls. Removing an inherited operation suspends it through an override; it cannot silently reappear from the source rig. In-use/inherited targets cannot be deleted. Disable suspends a relationship and retains its references; it does not pretend to remove a required input. Removing a scene motion/relationship removes the complete operator. Artwork, bones and sockets retain their existing dedicated editors.

Paint order, parenting and masking remain separate from motion dependencies. Cards are not arbitrary serial effect chains: existing blocks are additive. Connections do not turn a flat image into articulated artwork, create perspective drawings, or establish animation quality/approval.

## Architecture and compatibility

`motionGraph.ts` projects canonical Doc 4 / Rig 4 programs into typed cards/edges, and applies validated immutable edits. There is no second executable graph schema. Scoped, URI-encoded IDs avoid collisions and the quote-sensitive selectors used by React Flow's real drag handles. Whole-document validation runs before semantic commits. Attachment and coordinate-space reconnection preserve the current pose for the supported lock operation; coordinate changes also preserve controller rotation.

React Flow is loaded only when opening the workspace. Pointer card positions remain transient until release. The studio's existing history receives atomic graph edits, preventing long drags from splitting at its ordinary coalescing timeout. UI layout data is bounded/allowlisted on import; invalid or future layout metadata is discarded without discarding the animation. Existing SVG/raster protections and motion budgets are unchanged.

Legacy animations keep their original controls and playback. The graph currently projects explicit motion programs and registered joints/sockets; it does not convert legacy bone/drawing tracks into new graph operators. Existing timeline/rig tools still edit those tracks. New explicit motion remains Doc 4 / Rig 4. No new public-viewer compatibility is implied.

## Acceptance and evidence

| Milestone | Result and evidence |
| --- | --- |
| Typed graph and safe commands | Scoped IDs, compatible ports, atomic invalid reconnects, cycles, inherited overrides, mirrored socket/space transforms and safe deletion covered by `motionGraph.test.ts`. |
| Draggable workspace | Real Chrome card and wire drags; accessible two-port connection; undo/redo; artwork byte preservation; saved JSON reopened and exported in `scripts/qa-node-editor.mjs`. Screenshots/report in `examples/node-editor/qa`. |
| Shared timing and posing | Sparse key retiming/collision tests, repeat durations, numeric controls, gesture release/cancellation and keyboard nudges in graph timeline/component tests; same studio clock and motion helpers as the stage. |
| Manageable authoring | Named owner labels, selected/all scopes, optional unused joints, search and seven editable recipes. Custom collapsible macro groups are not implemented. |
| Scene proof | Graph-organized family/bedtime masters built by `scripts/build-node-examples.mjs`; actual app importer/evaluator confirms unchanged artwork/motion and nine matching sampled snapshots per scene. See `examples/node-editor/validation.json`. |
| Human/agent contract | Composer 0.8.1 and Mid-century Ink 1.9.1 instructions use names/IDs in the same canonical program; versioned update overlays preserve private reference assets and approvals. |

## TDD record

Journeys came from the chat's approved node-editor plan. RED checkpoints precede production implementations: missing graph/layout/workspace and recipe/timing modules; a reconnect regression where moving a wire could leave the original operator driving; a real-browser regression where quoted IDs caused a DOM selector exception on wire drag. The same focused targets pass after implementation. Source-control checkpoints preserve these stages.

Focused verification: 68 tests across six files, including three layout tests also measured separately at 100% statements/branches/functions/lines. The graph/runtime-helper/UI coverage run exceeds 80% aggregate statements, branches, functions and lines; measured at 89.64% statements, 84.66% branches, 85.44% functions and 94.74% lines before the two additional operator-budget cases. Typecheck, production build and production dependency audit run before release. Mandatory push hooks run the full app suite and build; report their actual results in the PR rather than treating this checklist as evidence.

## Deliberate next work

Custom collapsible action macros, arbitrary expressions, simulation, general blending/compositing nodes, mesh topology/UV creation and continuous perspective generation require additional design/runtime work. The existing head drawings and prepared deformation remain available through their existing editors. This release improves authoring and control; it does not claim a new natural-acting benchmark or automatically improve the static family members. Review stills, contacts and transitions separately from structural validation.

App changes are prepared for review. A private plugin release does not merge or deploy the application.


### Compact cards and supporting detail

Cards keep the node name, type, disabled state and labeled ports visible. Long
names wrap to two lines; full names, owning objects, source and current activity
are available through the info button. Hover or keyboard focus previews that
information; click/tap keeps it open until an outside click, Escape or navigation.
The overlay stays at readable screen size when the graph is zoomed and remains
inside the phone dialog. No animation fields or saved layouts change.

The inspector and selection actions appear after selecting a node. Click blank
canvas to clear selection. Wire labels appear on hover or when an endpoint is
selected, avoiding redundant text over labeled ports.

Research before this refinement: [Houdini Node Info](https://www.sidefx.com/docs/houdini/network/info.html)
separates temporary inspection from persistent editing; [n8n node controls](https://docs.n8n.io/workflows/components/nodes/)
reveals secondary actions on hover and separates configuration. Animatron adapts
that progressive disclosure with explicit keyboard and touch access rather than
requiring hover. This was a documentation comparison, not hands-on competitor testing.
