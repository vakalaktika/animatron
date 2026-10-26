# Mid-century Ink Rig 1

This is the shared rigid-vector interchange contract for Agent Torres, Animatron,
and the Mid-century Ink generator. It is a custom format, not Spine, glTF or
Lottie. Ordinary SVG viewers show the artwork; skeleton editing requires an
importer for this contract. Keep this version stable across implementations.

## File and required fields

Use a single UTF-8 `name.mci.json` file containing:

```json
{
  "format": "mid-century-ink-rig",
  "version": 1,
  "name": "Display name",
  "canvas": {"width": 600, "height": 700},
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 600 700\">...</svg>",
  "bones": [],
  "bindings": [],
  "slots": [],
  "animations": [],
  "metadata": {"style": "mid-century-ink", "reviewStatus": "draft"}
}
```

`bones` and `bindings` must be nonempty. `animations` may be empty. `slots` and
`metadata` are optional and must survive a save/reopen round trip. Metadata is
descriptive only, never executable. Reject unsupported `version` values with a
clear error; do not reinterpret this object as an unrelated studio document.

## Coordinates and bones

SVG user units; origin top-left; +X right, +Y down. Angles are degrees, positive
clockwise. Exactly one root, arbitrary acyclic parent hierarchy, unique stable
IDs. IDs start with an ASCII letter and use letters, digits, `_`, `-`, `.` up to
80 characters. Bone roles use the same syntax and are unique when supplied.

Each bone is `{id, parentId, role?, name?, rest:{x,y,rotation}, length, limits?}`.
`parentId` is another bone ID or `null` for the root. Rest translation is in the
parent's coordinate frame; rest rotation is local to that parent. `length` is a
nonnegative visual tip distance along the bone's local +X axis. It is not the
distance from the origin to an arbitrary child. Limits are `{min,max}` on the
rotation DELTA from rest and must include zero. Bone scale/shear and mesh weights
are outside v1. Stage placement/scale can wrap the whole asset independently.

Semantic human roles: `root`, `torso`, `head`, `arm.left.upper`,
`arm.left.forearm`, `arm.left.hand`, their `right` equivalents,
`leg.left.upper`, `leg.left.lower`, `leg.left.foot`, and their `right` equivalents.
Left/right describe the CHARACTER, not the viewer. Custom animal/object roles
are allowed. Missing roles must disable incompatible preset actions, not map
them to unrelated bones. No single human skeleton is required for every subject.

## SVG geometry and binding

SVG `viewBox` must be `0 0 canvas.width canvas.height`. Use direct child `<g id>`
groups for drawable parts; every such group is bound exactly once. Bindings
cannot target nested/overlapping ancestor and descendant groups. SVG DOM order
is paint order and remains independent from the bone hierarchy.

Each binding is `{id,svgId,boneId,bindMatrix:[a,b,c,d,e,f]}`. The matrix maps the
original group/document coordinates into the bone's rest-local frame. Wrap the
ORIGINAL group with `posedBoneWorld * bindMatrix`; retain its own internal
transforms. For source groups already placed in SVG document coordinates,
`bindMatrix = inverse(restBoneWorld)`. Do not apply the inverse twice or change
the shape's authored coordinates. At rest the wrapper is identity. The included
fixture demonstrates original group transforms and inverse binding together.

Use SVG's affine convention `x'=a*x+c*y+e; y'=b*x+d*y+f`. Matrices compose with
column vectors: `parentWorld * translate(rest.x+delta.x,rest.y+delta.y) *
rotate(rest.rotation+delta.rotation)`. Clamp rotation deltas to bone limits.

Shared baseline SVG subset: groups, path, rect, circle, ellipse, line, polyline,
polygon, title and desc; solid fill/stroke, opacity and geometric transforms.
No embedded raster images, scripts, event attributes, external references,
foreignObject, live text, CSS/style blocks, gradients, filters, masks, or use.
Outline any lettering in the art; surrounding UI/document text stays editable.
An importer must validate this subset before rendering groups inline. Ordinary
unrigged SVG import is a separate workflow and keeps its current behavior.

When moving a rest joint, recompute bindings from the new rest world transforms
to keep the original artwork in place. Pose edits instead change the posed bone
transforms. Present these as distinct operations. Binding reassignment likewise
recomputes the new inverse-rest matrix and preserves the neutral drawing.

## Attachment slots

Each slot is `{id,boneId,x,y,rotation}`, a named attachment frame in bone-local
coordinates, e.g. a grip or hat position. The frame moves with its bone.
Preserve all slots even when a tool does not yet expose attachment editing.

## Animation

Each clip is `{id,name?,duration,loop,tracks}`. Duration is seconds, >0 and <=600.
Each track is `{boneId,keys}`; at most one track per bone in one clip. Keys have
`{time,x,y,rotation,easing}` with ALL numeric fields required. They are deltas
from rest, never absolute world transforms. Key times strictly increase from
0 through duration. `easing` is `linear` or `hold` and governs interpolation
from that key to the next. Linear rotations use their explicit numeric span,
not automatic shortest-path wrapping. Before/after the key range, hold the
first/last key. Missing bone tracks use zero deltas.

Loop time uses positive modulo duration; non-loop time clamps to [0,duration].
An authored seamless loop needs matching endpoint poses. Playback and scrubbing
must evaluate from time rather than accumulate incremental rotations.

Recording a pose saves all bone deltas at the chosen time. Changing clip
duration rescales its key times. A shared clip can be retargeted only through
compatible semantic roles, proportional translation mapping and explicit joint
limits. Do not promise that arbitrary skeletons share every animation. Initial
Torres support provides role-gated wave/nod and arbitrary pose recording;
its 33 legacy actions remain available on the original Torres rig.

## Validation and budgets

Reject missing parents, cycles, repeated IDs/targets/roles, non-finite numbers,
singular binding matrices, unresolved SVG groups and malformed keyframes.
Baseline limits: 4 MB JSON, 2 MB SVG markup, 128 bones, 256 bindings, 128 slots,
64 animations, 10000 total keys, and 3000 SVG elements. Validate before replacing
the current asset. Preserve existing work after an invalid import.

## Required checks

- Neutral pose renders identically before/after binding.
- Parent rotation moves descendants exactly once; siblings remain independent.
- Rest-joint editing keeps the drawing fixed; posing moves it around that joint.
- Joint limits apply to manual posing, IK and animation playback.
- Ink and color belonging to a part move together; overlaps hide joint gaps.
- Save/reopen preserves bones, bindings, slots, animations and metadata.
- Invalid input cannot erase the current project or execute imported SVG.
- Reduced-motion mode stops autoplay but keeps still-frame scrubbing/editing.
- Preserve unrigged imports and older projects through document migration.

Reference implementation: `private/agent-torres/mci-rig-core.cjs`.
Cross-tool fixture: `docs/mci-rig/example-character.mci.json`.
