# Illustrated scene production

## Art direction before mechanics

Record these choices independently: treatment (`classic-graphic` or `detailed-storybook`), scene richness (complete setting by default), finish (clean flat shapes/selective ink), and motion complexity (restrained by default). Original is not a sparse-scene preset; Detailed does not mean more outlines, gradients, grain or clutter. Preserve active style authorities, accepted proportions, identity anchors and approval records. New reference pictures guide quality; their depicted people are not approved saved characters.

1. Write the action and emotional beat in one sentence. Identify cast, frame size, requested duration, loop behavior, focal point and palette.
2. Sketch the composition: foreground, characters, coherent props and background; overlaps, gazes, hand grips, planted feet and readable negative spaces. A prop must have one plausible perspective and recognizable construction; a paper airplane needs coherent folded planes, a bicycle needs aligned wheels/frame/pedals/handlebars, a bed needs believable mattress/pillow/blanket relationships.
3. Finish a key pose before finalizing the skeleton. Select the actual treatment references and inspect them directly at useful viewing size. If unavailable, record the missing reference and call the comparison unverified. Do not substitute structural validity for this review.
4. Review silhouette, proportions, face construction, hands, clothing, contact points, color balance and room composition. Economical interior marks describe necessary folds, features or overlaps. Purposeful empty areas keep the focal gesture legible. Original can use simple faces and strong irregular graphic shapes in a fully developed room; Detailed uses descriptive noses/eyes, natural cartoon proportions and expressive asymmetry without photographic rendering.
5. Only then prepare the parts needed for the planned motion. Keep the still/key pose alongside the rig. At the rest pose, their visible appearance should agree.

## Path A: authored editable vectors

Use semantic SVG groups, deliberately authored Bézier contours, taper and asymmetric silhouettes. Volume models help check foreshortening and repeated proportions; their ellipsoids/capsules are optional underdrawing. Do not let a generic primitive hull decide cheeks, hair, fingers, sleeves, a dog's muzzle or a species-specific paw. Separate movable pieces without breaking ink/fill alignment. Keep complete environments as background and foreground groups; static scenery needs no unnecessary bones.

Use existing Rig 1 for vector skeletons. For head angles and gestures, draw needed replacement views rather than rotating a flat face to fake perspective. Register views at a common neck/wrist anchor; match scale and identity. Existing parking-based performance rigs remain supported. New Rig 2 `drawingSets`/`drawingTracks` explicitly select eyes, mouths, hands or head angles, with hold transitions and stable paint order; see `mci-rig-v2.md`.

## Path B: layered illustration

Start from a high-resolution background plus separate transparent character/prop parts. A flattened picture is a painting, not automatically a clean rig. Create isolated parts directly when possible. When extracting from a finished picture, inspect the actual masks and reconstruct concealed anatomy/clothing economically: label inferred areas, remove background color halos and preserve antialiased transparent edges. Keep lossless transparent PNG masters and the editable source used to create them.

Make a part inventory with source file, pixel size, canvas position, anchor, bone, paint order and visible/inferred areas. Rig 2 `rasterAttachments` embeds validated PNGs inside bound SVG groups; inverse-rest matrices preserve registration. No remote images, arbitrary SVG `<image>`, external fetches or animated payloads. The new contract is explicit; do not put Rig 2 fields in Rig 1. High-resolution art must fit the actual importer budgets; do not silently flatten, lower quality or claim transparency is verified without viewing it.

Inspect rest, mid-motion and extreme poses against contrasting light/dark backgrounds. Repair seams, joint holes, clipped fingers and detached marks. Hide seams under designed overlaps or create a replacement drawing at that angle. Rigid attachment rotation is not mesh deformation. Add deformation only after a concrete action demonstrates need and an editable round-trip fixture proves it.

## Motion and delivery

Choose a few meaningful movements: gaze leads the head, anticipation prepares a hand lift, the arm carries the held prop, then both settle. A hand and paper airplane should share a carrier bone/slot or baked contact solution. Verify world-space contact through intermediate frames. Static feet should remain planted; do not add arbitrary global breathing translation that slides them. Use replacement drawings for actual head-angle changes, blinks and hand shapes. Inspect replacement transitions, not just first/last pictures.

Use expressive holds, restrained overlap and subtle environmental action. Camera/parallax is optional and must preserve framing, margins and focal contact. Do not animate every room object. Provide a reduced-motion still. The animation's requested duration and loop status are explicit; include or remove the application's timeline tail deliberately. Check visual endpoint agreement and motion velocity/spacing continuity separately.

Validate structure, then review rendered artwork separately. Record the renderer/evaluator used, inspected frame times, visual findings, remaining uncertainty and file hash. Neither report implies user approval. Use the application's evaluator/renderer for previews when available; label alternate renderers and untested browser behavior. Deliver still artwork, editable master, rig, importable composition and animation preview. Keep optimized playback copies separate; compare sampled frames and timing before claiming a lossless optimization. Supply the JSON even when a share link exceeds its budget.

## Example production briefs (invented cast, not identity authorities)

**Detailed — Window launch.** An invented child at a curved worktable lifts a folded paper airplane while an adult looks on from an adjacent chair; their attentive gazes meet the plane. A window, shelf, plant and overlapping foreground chair compose a complete room with quiet space around the gesture. Descriptive modest eyes, readable noses, directional grouped hair and shaped hands carry the expression. A bird passes outside. Animate a blink, registered head turn, hand/plane lift and settling; leave most room objects still. These characters and the layout are not copies of reference people or compositions.

**Original — Bread's bedtime.** An invented child leans into a pillow beside a generic bread plush, rabbit and bear. Strong flat blanket, headboard, lamp, window, shelf and floor shapes establish a room; simple expressive faces and selective fine ink establish the graphic treatment. Protect negative space around the child's face and plush silhouettes. Animate one blink, a small hand settle and restrained curtain motion. Keep the bread's crust/crumb shapes legible and all plushes generic.
