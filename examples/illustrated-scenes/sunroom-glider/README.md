# Sunroom glider: generated Detailed illustration

This candidate demonstrates preserving generated Mid-century Ink artwork through layered animation. It replaces the **visual benchmark claim** of the older code-drawn Garden fixture, while keeping that fixture and its compatibility tests. It is an internally reviewed example, not user-approved character or style authority.

## Deliverables

- [Preview and downloads](index.html) · [8-second app MP4](preview.mp4)
- [Generated finished key pose](source/key-pose.png) · [Rebuilt application still / reduced-motion presentation](preview.frame-0.00.png)
- [Importable composition master](sunroom-glider.animatron.json) · [Separate compact playback copy](sunroom-glider.playback.animatron.json)
- Editable rigs: [character parts](sunroom-glider.mci.json), [room](room.mci.json), [bird](bird.mci.json)
- [Layered paint master (OpenRaster)](sunroom-glider.ora): eight registered layers, with alternate heads and bird hidden in the resting still. PNG parts remain available separately.
- [Part inventory and registration](part-inventory.json) · [Source/edit prompts](source/prompts.md) · [Reproducible assembly](build.mjs)
- [Blink](preview.frame-1.15.png), [first turn drawing](preview.frame-2.80.png), [turned hold](preview.frame-3.50.png), [loop end](preview.frame-7.96.png)

Import the composition in the upgraded application from PR #25. It exceeds the hash-link budget, so no opening link is provided. Importing only the character rig omits the separate room/bird; use the composition for the complete scene. Layered editability means separate painted parts, poses, registered drawings and timing. Internal ink/fill strokes are not editable vector curves. Native vector production remains a separate supported path.

## Art direction and production

An invented mother and young boy watch a school-age girl proudly hold a paper glider in a complete sunroom craft setting. Connected gazes, quiet negative space around the raised hand, a curved table, shelf/plant and garden window support the action. Detailed is retained across the cast. The existing private primary Detailed scene and selected adult face crops were viewed and supplied to each built-in image-generation call as style inputs; their people are not copied or saved as approved identities. Original assets and authorities were not changed.

The illustration was generated first. Separate generated clean-plate and transparent-part edits then reconstructed the concealed sky, garden/wall, lower forearm and neck/collar. These are supervised generated reconstructions, not pixel-identical automatic extraction. The extraction shifted left: the final assembly explicitly translates the arm/bird +30 px and head +38 px. The shaped cuff is registered +35 px. Blink, intermediate and turned heads share a 480×512 drawing frame and collar anchor; larger source replacement PNGs are retained separately.

An initial intermediate head was rejected because it resembled the final angle too closely. A targeted corrective drawing is used. An initial rectangular foreground cuff crop made an obvious straight forearm cutoff; the final generated shaped-alpha cuff restores a curved overlap. Source files preserve the actual generation outputs; the discarded intermediate is not installed as a new style reference.

Room artwork stays at its original 1536×1024 resolution. Its separate static rig is below the transparent character rig, with the small bird above, confined to sky above the people. Existing clip ordering and renderer are reused. Adaptive PNG filtering compresses losslessly, and RGB is cleared only where alpha is exactly zero. Part preparation resamples oversized head edits into their registered frame; it does not claim those resampled derivatives are byte-identical source masters. No palette reduction, background downsampling or renderer replacement is used in the final deliverable.

## Visual review and limits

Compared directly with the selected primary anchor, the new artwork has coherent three-quarter faces, descriptive noses, natural cartoon proportions, age-specific cheeks/jaws, connected gaze, shaped fingers and believable sleeve/wrist relationships. Broad color fields and selective marks carry the scene rather than primitive projected hulls. It is substantially closer than the earlier code-drawn fixture. It still has more hair highlights, fine folds and tonal finish than the anchor; the girl's replacement eyes open somewhat more in the frontal view. Those are remaining style differences, not a new approved target.

Actual application frames were inspected at 0, 1.15, 2.70, 2.80, 3.00, 3.50, 4.80, 5.00 and 7.96 seconds, including useful-size sleeve/neck/hand views. The final cuff covers the lower forearm at rest and maximum lift; no open joint gap or detached hand/plane was observed. Alpha edges were also viewed against light and dark mattes. The source/key-pose and rebuilt still differ slightly in repainted hair/neck/cuff; exact source-pixel reconstruction is not claimed.

The head uses three held perspective drawings, not mesh interpolation; the turn has a deliberately stepped limited-animation cadence, with small hair/feature shifts between generated drawings. It is not a fully in-betweened or production-cleanup-quality head turn. The bird has a single illustrated wing pose and fades during its passing flight; its backward reset occurs while opacity is zero. This is not a flapping bird rig. Most scene elements stay still.

## Technical verification

- Eight seconds at 24 fps, loop enabled, explicit zero timeline tail. Main lift channels hold still around both loop boundaries; velocity continuity is checked separately from rendered endpoint equality. First and last captured app-frame pixels match exactly.
- Six character attachments, one room attachment and one bird attachment; each rig passes the unchanged PNG/resource/security validator. Whole compact composition is about 3.14 MB, below the 4 MB JSON limit; each rig remains below the 2 MB raster budget. See inventory for exact sizes. Playback JSON differs from its master only in whitespace.
- Six new fixture tests and six old fixture regressions pass. They check safe payloads, composition/master equality, exclusive drawings, 385-sample rigid hand/plane contact, static root, main motion seams, hidden bird reset, transparent/partial-alpha parts, edits, serialized assets and the actual app preview round trip.
- Built-app browser journey passes for both new and legacy layered examples: import → select drawing → pose lift → autosave → reload → Save rig / Download JSON. New scene retains all eight payloads across its three clips. Reduced-motion arrival stays paused; explicit playback remains available. No page exceptions; screenshots at 1440×1000 and 390×844.
- MP4 and stills use application StageCanvas/snapshotStage/renderVideo in Chrome 156.0.8078.80. The preview harness supplies minimal positioning CSS; this scene has no font, video or audio inputs. Other browsers were not separately tested.
- OpenRaster follows the [baseline archive layout](https://www.openraster.org/baseline/file-layout-spec.html) and [layer stack specification](https://www.openraster.org/baseline/layer-stack-spec.html). ZIP order, mimetype, XML layer references and CRCs are checked. Its merged preview is the actual application still. A native paint-editor open/save round trip was not separately tested; the Animatron round trip above uses the JSON composition.

After rendering, `node examples/illustrated-scenes/sunroom-glider/package-artwork.mjs` losslessly recompresses captured PNGs (decoded pixels must match exactly), then packages the layered paint master and thumbnail. The renderer and artwork are unchanged.

Reproduce: `node examples/illustrated-scenes/sunroom-glider/build.mjs`, then `node scripts/preview-scene.mjs examples/illustrated-scenes/sunroom-glider/sunroom-glider.animatron.json examples/illustrated-scenes/sunroom-glider/preview --times=0,1.15,2.70,2.80,3.00,3.50,4.80,5.00,7.96`; run `node --test examples/illustrated-scenes/fixtures.test.cjs examples/illustrated-scenes/sunroom-glider/scene.test.cjs`. Browser QA accepts the composition path and an output folder as its two optional arguments. New previews must be generated after changing source artwork or timing.
