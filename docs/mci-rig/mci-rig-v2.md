# Mid-century Ink Rig 2 — illustrated attachments and registered drawings

Rig 2 is an additive rigid-artwork contract for `format: "mid-century-ink-rig"`, `version: 2`. It keeps every Rig 1 bone, binding, slot, vector SVG rule and animation rule. The application reads both versions; existing Rig 1 files and parking-based animations continue unchanged. New extension fields require version 2. `upgradeRigToV2(asset)` returns a new asset changing only `version`; never down-save a Rig 2 master as Rig 1 or silently discard unknown master metadata, identity records or approvals.

## Separated illustrated parts

```json
{
  "rasterAttachments": [
    {"id":"sleeve-paint","svgId":"sleeve","src":"data:image/png;base64,...","x":210,"y":180,"width":260,"height":340}
  ]
}
```

Author a direct-child `<g id="sleeve"/>` in `svg`, and bind it to a bone with the existing `bindings` array. The application constructs one trusted image node inside that group after PNG validation; raw SVG `<image>` stays forbidden, even in Rig 2. A group may have vector geometry too: raster paints first, then vector children in their authored order. SVG group order determines foreground/background order. Each group has at most one attachment; use separate groups to interleave parts. `x/y/width/height` are in authored canvas coordinates, before the group's existing SVG transform and `posedBoneWorld × bindMatrix`. For canvas-coordinate artwork, use the inverse bone rest-world matrix as the binding. Native PNG alpha is preserved; no background removal, seam correction, mesh deformation, or automatic part extraction occurs.

Only inline PNG is accepted. Strip metadata before attaching: allowed chunks are IHDR, PLTE, tRNS, IDAT, IEND. Validation checks strict base64, signature, bounded chunk structure, CRC, IHDR color/depth, dimensions, and presence of IDAT/IEND. Remote URLs, SVG, animated PNG and ancillary metadata are rejected. Per-side maximum is 4096 pixels; combined attachments must stay within 16,000,000 decoded pixels and 2,000,000 compressed PNG bytes, at most 128 attachments. The original 4,000,000-byte JSON, 2,000,000-character SVG, 3000 SVG element, 128 bone and 256 binding budgets remain. Structural PNG validation does not inflate/decode IDAT; verify browser decoding and rendered alpha before delivery.

Create or extract separate parts, reconstruct concealed areas and preserve transparent overlap beyond joints before importing. Review seams at the largest planned pose excursion. Keep full-resolution masters separate from playback assets. An attractive flattened picture is a still, not a clean rig.

## Registered replacement drawings

```json
{
  "drawingSets": [
    {"id":"head","defaultDrawingId":"front","drawings":[
      {"id":"front","svgIds":["head-front","eyes-open"]},
      {"id":"profile","svgIds":["head-profile"]}
    ]}
  ],
  "animations": [{"id":"look","duration":4,"loop":true,"tracks":[],
    "drawingTracks":[{"setId":"head","keys":[
      {"time":0,"drawingId":"front"},
      {"time":1.2,"drawingId":"profile"},
      {"time":3,"drawingId":"front"}
    ]}]
  }]
}
```

All referenced groups must be existing bound direct children, and a group belongs to at most one drawing across all sets. Sets have unique ids and a valid default; drawing ids are unique within a set. Every drawing has at least one group. Independent eyes/mouths can use separate sets, provided their groups are not shared. Register all views to the same neck/eye/hand contact landmarks; visibility cannot correct bad registration or perspective.

A selected drawing's groups have opacity 1; the other registered groups have opacity 0. Unregistered groups remain visible. Selection keys are discrete holds and strictly increase within clip duration, at most one track per set. Before the first key, use the set's default; after the last, hold; looping uses the same modulo clock as bone animation. At an exact boundary the new drawing is active. A continuous head turn needs authored intermediate views timed through the turn; rotating a flat face does not create perspective.

There are at most 64 sets, 128 drawings per set, 64 drawing tracks per animation, and 10,000 animation keys total across bone and drawing tracks. Unknown set/drawing targets, duplicate membership, unsorted keys and mixed version fields fail validation.

The Skeleton panel's Replacement drawings controls edit the master default when no animation is selected, or record a discrete key at the active animation playhead. Values persist inside the rig, including Save rig, composition save/reopen, JSON/share round trips and generated runtime export. Duration edits rescale both bone and drawing times; timeline key dragging includes drawing keys when it is not scoped to a bone key. Drawing keys do not blend. Group opacity switches deliberately, without tweening.

## Runtime and verification

The app's `engine/rigV2.ts` is authoritative for extension checks and drawing evaluation. `node scripts/sync-rig-v2.mjs` generates the dependency-free `mci-rig-v2.cjs`; `--check` verifies no drift. Node's existing `mci-rig-core.cjs` loads it automatically. Browser users loading the reference runtime directly load `mci-rig-v2.cjs` before `mci-rig-core.cjs` for Rig 2; Rig 1 standalone browser core remains supported. Plugins must package both CJS files.

`mci-rig-v2.schema.json` describes fields; semantic target/CRC/budget checks remain runtime validation. `validate-rig.cjs` reports structural checks only. Application SVG parsing, actual raster decoding, render review, joint seam checks, and user approval are separate checks. There is no mesh bending in this release. Rigid bone transforms, discrete drawings, editable vector shapes and painted PNG attachments are the implemented paths.
