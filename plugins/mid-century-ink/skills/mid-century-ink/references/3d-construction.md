# Think in 3D, draw in 2D

Volumes are construction aids for proportion, perspective and consistent views. They do not establish finished drawing quality and cannot prevent every kind of visual drift. Begin with art direction and a convincing finished key pose (`illustrated-scene-production.md`), then use the tools below where useful. Authored turn drawings, deliberately asymmetric contours, expressive hands, clothing and species anatomy may depart from projected primitive hulls while preserving the design. Keep construction and finished artwork as separate editable layers. Existing volume-generated examples remain valid mechanics demonstrations, not a required finish.

`scripts/volume.mjs`, `scripts/render.mjs` and `scripts/turnaround.mjs`
implement this. `examples/dot/dot-model.mjs` is a complete character model.

## 1. Optional volume construction

Use the fewest volumes that carry the design:

| Part | Primitive | Why |
|---|---|---|
| Skull, hair mass, hands, simple animal bodies | ellipsoid | Its silhouette is an ellipse from any angle; surface points carry features |
| Torso, skirt, neck, sleeves, cups, cans | elliptic frustum (two cross-section ellipses) | Taper and depth in one shape; cross-sections show the turn |
| Limbs, tails, ponytails | tapered capsule between two joints | A limb's width stays constant as it rotates; only its length foreshortens |

Coordinates: x is the character's LEFT, y up, z forward (out of the chest).
Write joints as 3D points. Keep the selected treatment's proportions in the
model itself (see "Treatments in 3D" below); the projection never adds
realism.

### Any subject: declare it as parts

For animals, creatures, objects and props, declare the subject as a list of
parts for `scripts/figure.mjs` (`examples/pip/pip-model.mjs` is a complete
terrier). Each part has a 3D shape, a fill, an ink treatment and the bone it
moves with:

| Shape | Use |
|---|---|
| `ellipsoid` | heads, bodies, bellies, paws, beards, fruit, balls |
| `frustum` | torsos, skirts, cups, lamp shades, tree trunks |
| `capsule` | limbs, necks, snouts, tails, handles |
| `band` | collars, cuffs, belts, straps, rings around any axis (two rings perpendicular to it, joined) |
| `patch` | a region of an ellipsoid's surface: saddles, face masks, spots, a fruit's blush |
| `flap` | a flat piece in 3D: ears, fins, leaves, wings at rest, flags |

Marks (`dot`, `line`, `nose`, and the Detailed `eye`) pin to a part's
surface by longitude and latitude. Paint order is by depth in each view, nudged with `bias`; ink
`edge` gives a limb one open edge away from the body or a body one belly
line. A part that should look like a band, a strap or a plate must be built
as one: a short fat capsule reads as a ball from the side.

## 2. Pin features to surfaces, never to the picture

Features live on the form, in surface coordinates (longitude: 0 is the front
centre line, +90 the character's left; latitude: +90 the top):

- Eyes: one latitude for both (the eye line), longitudes about ±20°.
- Nose: a small wedge on the centre line (lon 0), pointing out along the surface normal.
- Mouth: three points on the centre line and either side, below the nose.
- Ears: lon ±90 to ±100, at the eye-line latitude or slightly below.
- Cheeks, collars, buttons, patterns (polka dots): points on the torso or head surface.
- Hair: a SHELL ellipsoid slightly larger than the skull, plus a FACE
  OPENING (a region on the skull's front where skin shows: lon ±70, from the
  chin to the hairline). Fringes are a cap on the shell; ponytails and buns
  are pinned to the shell's surface.

A mark is drawn only when its surface faces the camera (normal toward the
viewer). It shrinks horizontally by how obliquely it is seen, so the far eye
in a three-quarter view is narrower and nearer the edge without anyone
deciding that by hand. The nose tip breaks the silhouette on the facing side
only once the head turns past about 30°.

## 3. Project, then flatten

For a view (yaw = turn about the vertical axis; pitch = camera above or
below), project every volume orthographically. Mid-century illustration is
near-orthographic; add perspective only for a deliberate low or high camera.

- Silhouettes: an ellipsoid becomes the hull of its projected surface; a
  frustum becomes the hull of its two cross-section rings; a capsule the hull
  of its two end spheres.
- Paint order: by depth in that view (nearer last). Fix the few exceptions
  explicitly: the hair shell always under the face opening; the skirt over
  the thighs; legs behind the skirt.
- Then style the flat shapes: flat fills, one open ink edge per limb, ink on
  the jaw edge of the face only, black masses separated by a fine paper line
  where they overlap (a ponytail over a bob).

## 4. Standard views and the turnaround sheet

Draw every recurring character as a turnaround before rigging:

| View | Yaw | What changes |
|---|---|---|
| front | 0 | symmetric; both eyes evenly spaced; nose a short mark |
| three-quarter | ±45 | centre line moves toward the far side; far eye narrower; nose tip at the far contour; far arm partly behind the torso |
| profile | ±90 | one eye; nose and lips break the contour; far arm and leg hidden or behind; shoulders as narrow as the torso's depth |
| back three-quarter | ±135 | face opening hidden, a sliver of cheek at most; hair shell dominates |
| back | 180 | no face; shell, ponytail, back of collar |

`node scripts/turnaround.mjs examples/dot/dot-model.mjs out/` writes the
sheet (`*-turnaround.svg`), the same sheet with the construction drawn
through (`*-construction.svg`: centre lines, eye line, cross-section ellipses,
hidden halves dashed), and one SVG plus one Rig 1 master per view.

## 5. Check volume consistency (do this on every sheet)

Draw parallel tracking lines across the sheet and check:

1. Head top, eye line, chin, shoulder line, waist, hem and soles sit on the
   same horizontal lines in every view (orthographic, level camera).
2. Widths change only by rotation: the torso is widest at front/back and
   equals its depth in profile; a sphere's width never changes.
3. The centre line of the face and torso moves smoothly across the form as
   the yaw grows (0 at front, at the edge by profile), on the cross-section
   ellipse, not jumping.
4. The eye line wraps the head as an ellipse, both eyes on it.
5. Overlaps flip at the right moment: the far arm goes behind the torso
   past about 30°; the near arm in front.
6. Hair and attached shapes stay pinned to the same spot on the form.

If a check fails, fix the MODEL (a radius, a joint, a surface coordinate),
not the drawing of one view.

## 6. A 180° head turn, or a camera tracking around a character

Use the model, not a set of loose drawings:

- Key the views at 0, 45, 90, 135, 180. Add 22.5° steps where the turn is
  slow or the head fills the frame.
- Anchor the skull's centre and keep its radius; the silhouette of an
  ellipsoid only changes by its own proportions.
- Track the features along their latitudes: each one travels on an
  elliptical path across the face (the eye line seen at that pitch), speeding
  up through the middle of the face and slowing at the edge where it
  disappears. Never slide a feature in a straight line.
- Hand off at the contour: the nose tip breaks the silhouette at about 30°;
  the far eye leaves at about 60–70°; the ear appears near the profile.
- For a moving camera, also step the pitch, and re-check the tracking
  lines: they converge or tilt with the camera, consistently in every drawing.
- Give the turn a curve, not a flat spin: dip the head a few degrees
  through the middle (an arc), lead with the eyes or nose a drawing early,
  and let hair settle a few frames late.

## 7. Rig every view, not one drawing

A Rig 1 bone is a rigid rotation IN THE PICTURE PLANE. That decides what
each view can animate:

- A motion seen as rotation in a view gets a wide joint range in that view
  (an elbow bending, seen from the side; an arm raised sideways, seen from
  the front).
- A motion seen as foreshortening in a view gets a small range there (the
  same elbow bending toward the camera, seen from the front); animate it in
  another view, or swap to a drawing of the foreshortened pose.
- One-way joints (elbow, knee) bend one way, and that way flips with the
  facing direction.
- Paint order is fixed per file: keep a limb's motion within its depth
  layer (the near arm stays in front of the body). A limb that must cross
  behind needs a second drawing of it, or a view change.
- Same bone ids and roles in every view, so a motion written for one view
  can be retargeted to a mirrored or neighbouring view and checked.

`scripts/render.mjs` (viewRig) sets these limits from each joint's motion
type and the view's yaw. Turning the character uses VIEW SWAPS (see
`motion.md`), not a rotation of one rig.

## 8. Performance rigs: split for range and fluid motion

For anything that performs (more than a single gesture), build PERFORMANCE
rigs with `scripts/perform.mjs`: one per body view, each with the splits the
subject's movement study calls for (`references/movement-analysis.md`). For a
person that means at least:

- head split from body (neck bone, head bone), with a HEAD SWAP SET of
  head views registered at the top of the neck, so the head turns before the
  body, or without it;
- eyes open / closed per head view (blinks; a blink also hides a head swap);
- each hair mass, tail or loose garment on its own bone (drag, settle);
- clavicles (shrugs, natural arm raises); hips, skirt or coat as their own
  pieces.

Rig 1 has no visibility channel, so swap drawings are switched by PARKING:
every state sits at its true place at rest (so joint editing still works),
and states not in use are moved far off the canvas by the still pose
(`metadata.defaultPose`) or by "hold" keys that `scripts/motion.mjs` writes
from `"swap"` entries. At bare rest every state shows stacked: that is the
swap sheet, not a bug. Always place a performance rig with its default pose.

## 7. Treatments in 3D

The pipeline (volumes, turnaround, per-view rigs, motion) is the same for
both treatments; what changes is what you build. Resolve the treatment first
(`style-presets.md`), set `treatment` on the model (`"classic-graphic"` or
`"detailed-storybook"`; Original is the default), and every view rig records
it in `metadata.treatment`. `scripts/scene.mjs` refuses to combine members
drawn in different treatments.

| | Original / Classic graphic | Detailed storybook |
|---|---|---|
| Visual input | historical pair (`style-reference.png` + `reference-8591.jpeg`) | `detailed-primary-scene-v1.jpeg`, plus the two adult face crops when adults appear |
| Proportions in the model | elongated, slim, tapered; long thin limbs, small pointed feet; a child about half an adult | natural cartoon proportions; real age and build differences; children with short lower faces and fuller cheeks. Do not reuse Original's elongated body |
| Eyes | `dot` marks (closed arcs for laughs) | `eye` marks: modest shaped light area, compact directed pupil, tapered upper lid; neutral and task-focused faces visibly open. Vary per person and expression (`detailed-feature-choices.md`) |
| Nose | `nose` wedge on the centre line | a readable, identity-specific nose: a `nose` bend sized for the face, or a capsule/ellipsoid with a short underside `line`; never omitted on a visible face |
| Brows, mouth | optional; one curve | `line` brows and mouth chosen for the expression |
| Hair | a shell plus a few solid notched masses | a shell plus a few directional groups (patches, flaps) with limited cut-ins |
| Ink | one open edge per limb, jaw edge only | selective tapered ink at lids, nose turns, overlaps; broad fills carry most boundaries |

The face-construction rules (one view per head, features on the surface,
eye line on one level relative to the head's tilt) hold for both. Dot and Pip
in `examples/` are Original pipeline demos; never use them as Detailed style
or identity anchors. Review a Detailed rig's rendered views against the
primary scene before calling it done.
