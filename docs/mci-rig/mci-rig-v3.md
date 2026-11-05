# Mid-century Ink Rig 3 — native sparse tweens

Rig 3 (`format: "mid-century-ink-rig", version: 3`) inherits the complete Rig 2 raster attachment, vector, hierarchy and registered-drawing contract. It adds optional **outgoing** `tween` timing to a bone key. The application continues to import Rig 1 and Rig 2 without changing their linear/hold playback. Older application builds reject Rig 3; deploy/merge status must be checked separately. A plugin update does not update the application.

```json
{"boneId":"forearm","keys":[
  {"time":0,"x":0,"y":0,"rotation":0,"easing":"linear","tween":{"name":"inOut"}},
  {"time":2,"x":0,"y":0,"rotation":-30,"easing":"linear"}
]}
```

This is two authored poses, evaluated continuously at any playback/export frame rate. No intermediate pose records or regenerated artwork are required. Time is in animation-local seconds. Each part has its own track/times. Transforms inherit through the existing bone hierarchy; attachment geometry and paint order are unchanged.

`easing` remains `linear` or `hold`. A hold always wins over a tween. Without a tween, behavior is unchanged. Presets are `linear`, `smoothOut`, `inOut`, `flight`, `backOut`, `anticipate`, `snap`, `custom`. Custom timing uses `custom: [x1,y1,x2,y2]`, finite x in 0..1 and y in -10..10. Curves are the application's existing deterministic timing functions; translation and rotation use the same progress. Overshoot curves can exceed endpoints; joint limits still apply. Rotation uses authored numeric degrees, not shortest-path guessing. Scale/opacity of whole objects remain the existing document property tracks.

The validator rejects curves in versions 1/2, unknown names, invalid coordinates and malformed keys. `setRigKeyTween` returns a new Rig 3 asset only when a curve is deliberately authored; clearing curves does not downgrade a master. `upgradeRigToV2` preserves version 3. No migration rewrites old assets. JSON Schema is a structural aid; the actual rig/SVG/image import is authoritative for semantic relationships, budgets and security.

## Production and compatibility

Use separate inspected artwork parts for articulated movement. Keep hands and carried props on a shared carrier or an explicitly verified attachment. Tweening a flattened scene moves the entire picture; it does not produce new anatomy, cloth bending or perspective. Head/eye/mouth drawing keys remain discrete holds. A three-view head change is still limited animation, not a continuously deforming face.

Use `scripts/sparse.mjs` for native independent key tracks and Composer `scripts/tween.mjs` to author object/part tracks in a composition. Existing `motion.mjs` retains its legacy sampled baking behavior for old targets and procedural constraints. Do not feed sparse curves to an old linear-only sampler: current contact tools either evaluate with the shared runtime or reject unsupported curved inputs. No automatic down-conversion is claimed.

Node `mci-rig-core.cjs` loads `mci-rig-v2.cjs` and generated `mci-easing.cjs`. Direct browser users load the latter two before core. `scripts/sync-rig-v2.mjs --check` checks generated source parity. The renderer/exporter samples the same app evaluator; it stores sparse editable keys even though video files necessarily contain rendered frames.

A matching last pose is only position continuity. Inspect velocity near the seam as well. Use a held rest at either end for a reliably quiet loop; no tool can guarantee meaningful contact or a good loop just because an importer passes.
