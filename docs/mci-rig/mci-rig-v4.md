# Mid-century Ink Rig 4 — persistent controls and selected raster bending

Rig 4 (`format: "mid-century-ink-rig"`, `version: 4`) retains Rig 3 artwork, vector hierarchy, raster registration, replacement drawings and native timing curves. It adds optional `motion` and `meshes`. Document 4 stores scene-instance motion and cross-object references. Older applications must reject these versions rather than silently omit the new behavior. A private plugin update does not deploy the application.

## Portable controls

`motion` contains optional `controllers`, `blocks` and `constraints`. Every operator has a stable ID; instance entries with the same ID override the corresponding portable rig entry. Times are owning-clip-local seconds. The TypeScript contract and actual importer/evaluator are authoritative; JSON Schema is an additional structural aid.

Controllers have `id`, optional `name`, `space`, `x`, `y`, optional `rotation`, and optional sparse `keys` for x/y/rotation using ordinary document property keys. Rig-local coordinates are the rig SVG canvas, not its centred object anchor. `stage` space is the composition stage. `object` space references another `clipId` and optionally a rig `slotId`, so it is scene-local and cannot be saved in portable Rig 4 motion. Instance overrides preserve the portable master.

Blocks carry `id`, `type`, `start`, `duration`, optional `repeat`, `alternate`, `ease`, and `controllerId` (omitted means move the object). Their values are additive offsets over the base animation:

- `path`: `points`, optional `closed`, `orient`, and `facingOffset`; reuse the existing arc-length path sampler.
- `transform`: sparse property deltas in `from` and `to`. Scale/opacity are additive deltas too, not multipliers.
- `oscillate`: `property`, `amplitude`, optional `cycles` and `phase`; evaluated directly from time for deterministic seeking.

Do not apply a second motion path when a sprite already carries the intended path. Author action and holds deliberately rather than oscillating every element.

Constraints carry `id`, optional name, interval `start`/`end`, `weight` or sparse `weightKeys`, and `enabled`. `ik` declares `rootId`, `midId`, `tipId`, `targetId`, and `bend` (-1 or 1). `aim` declares `boneId`, `targetId`, and optional angular `offset` from +X. Directed scene `attach` constraints declare `targetClipId`, optional `slotId`, a target-local `offset` {x,y,rotation}, and optional `followRotation`. External clip/socket references and attach constraints are stored in Document 4 instance motion, never portable Rig 4.

The evaluator samples base pose/blocks, resolves spaces and dependency order, then applies constraints before compositing. Full-strength reachable contact should be inspected at intermediate times. Partial weights intentionally relax contact. A target outside the chain's reach or constrained joint range produces a diagnostic; validation does not reconstruct anatomy or hide an impossible action. Multiple opposing drivers and dependency cycles are errors, not implicit priorities.

## Shared illustrated parts

Rig 4 optionally stores `rasterSources: [{id,src}]`, each a bounded self-contained PNG. A raster attachment can reference one with `src: "@atlas"` and declare `sourceRect: {x,y,width,height}` in source pixels. Its existing x/y/width/height register that crop in the illustration. The importer validates the entire PNG, source ID and crop bounds; external URLs remain forbidden. The renderer constructs nested SVG viewports from validated data, without accepting imported image elements or clip paths.

Shared PNGs count once toward the existing two-million-byte/sixteen-million-pixel raster budget; unused sources count too. The four-megabyte rig JSON limit remains. Document 4 also bounds total text to16million characters and graph traversal to250000values, across at most512clips; each program allows128operators and10000combined control/influence keys. This avoids eight copies of a parts sheet and keeps registration editable. Source rectangles currently support rigid attachments only: mesh deformation requires a whole PNG texture.

## Raster mesh extension

`meshes` is an optional list of up to eight meshes referencing existing validated raster attachments by `rasterId`. It is actual bone-weighted 2D deformation, not rigid rotation, a vector path morph, automatic part separation or a general mesh editor.

Each mesh has `id`, `rasterId`, `vertices`, and `triangles`. A vertex stores rest-canvas `x`, `y`, and 1–4 `{boneId,weight}` influences. Weights must be positive, reference existing unique bones and sum to one. Rest vertices lie inside the registered PNG rectangle; texture coordinates derive from those positions. Triangles contain three distinct vertex indices and must have nonzero rest area. Limits: 3–128 vertices, 1–256 triangles per mesh. Existing SVG/PNG protections and combined resource budgets remain unchanged.

Skinning cancels each influencing bone's rest matrix before applying its posed matrix. Rest geometry therefore reproduces the registered illustration. The renderer uses the same deformation evaluation in editor, previews and exports. Inspect transparency, internal seams, joint extremes and silhouette before accepting a fixture; structural validation alone proves none of those visual properties.

## Authoring, timing and delivery

Mid-century Ink `scripts/controls.mjs input.mci.json controls.json --out output.mci.json --repo /path/to/animatron` writes a portable Rig 4 master. Its controls spec is `{version:1,motion:{...}}`. Composer `scripts/motion-program.mjs` applies programs to selected composition clips and validates through the selected checkout's importer/evaluator. Both commands write complete files atomically, report only short summaries, and refuse semantic failures rather than return a misleading success.

New Document 4 compositions declare `timeline.duration`, `timeline.loop`, and `timeline.tailSeconds` explicitly. Content duration and post-animation hold are separate. Legacy omitted tails retain existing behavior. A matching start/end image does not establish velocity continuity. Deliver editable masters separately from deliberate compatibility bakes, label local previews accurately, and include importable JSON when a sharing link cannot fit or support the version.

Legacy standalone `mci-rig-core.cjs` remains the Rig 1–3 compatibility runtime. It must reject Rig 4 rather than sample only its old bone tracks. Use the application evaluator for these controls and for all cross-object dependencies. No new host, deployment, public share or user approval is implied by a technical PASS.
